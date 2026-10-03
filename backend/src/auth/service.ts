import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { AuthStore, StoredUser } from './store.js';
import { hashPassword, verifyPassword } from './passwords.js';

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function publicUser(user: StoredUser): PublicUser {
  return { id: user.id, email: user.email, name: user.name };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > 20) return null;
  if (/[\u0000-\u001F\u007F]/.test(name)) return null;
  return name;
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new AuthError(400, 'Enter a valid email address.');
  }
  return normalized;
}

function assertPassword(password: string): void {
  if (password.length < 8 || password.length > 128) {
    throw new AuthError(400, 'Password must be at least 8 characters.');
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

let googleClient: OAuth2Client | null = null;

function getGoogleClient(): OAuth2Client | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  if (!googleClient) googleClient = new OAuth2Client(clientId);
  return googleClient;
}

export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID || null;
}

export class AuthService {
  constructor(private store: AuthStore) {}

  async register(nameInput: string, emailInput: string, password: string): Promise<PublicUser> {
    const name = normalizeName(nameInput);
    if (!name) throw new AuthError(400, 'Name must be 1–20 characters.');
    const email = assertEmail(emailInput);
    assertPassword(password);
    const existing = await this.store.findUserByEmail(email);
    if (existing) throw new AuthError(409, 'An account with that email already exists.');
    const user: StoredUser & { createdAt: number } = {
      id: randomUUID(),
      email,
      name,
      passwordHash: await hashPassword(password),
      googleSub: null,
      createdAt: Date.now(),
    };
    await this.store.insertUser(user);
    return publicUser(user);
  }

  async login(emailInput: string, password: string): Promise<PublicUser> {
    const email = assertEmail(emailInput);
    const user = await this.store.findUserByEmail(email);
    if (!user || !user.passwordHash) {
      throw new AuthError(401, 'Email or password is incorrect.');
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new AuthError(401, 'Email or password is incorrect.');
    return publicUser(user);
  }

  async signInWithGoogle(credential: string): Promise<PublicUser> {
    const client = getGoogleClient();
    const clientId = googleClientId();
    if (!client || !clientId) {
      throw new AuthError(503, 'Google sign-in is not configured.');
    }
    let payload: { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string } | undefined;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError(401, 'Google sign-in could not be verified.');
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AuthError(401, 'Google sign-in could not be verified.');
    }
    const email = assertEmail(payload.email);
    const bySub = await this.store.findUserByGoogleSub(payload.sub);
    if (bySub) return publicUser(bySub);

    const byEmail = await this.store.findUserByEmail(email);
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== payload.sub) {
        throw new AuthError(409, 'That email is already linked to a different Google account.');
      }
      if (!byEmail.googleSub) {
        await this.store.linkGoogle(byEmail.id, payload.sub, Date.now());
      }
      return publicUser(byEmail);
    }

    const name = normalizeName(payload.name || payload.given_name || email.split('@')[0] || 'Player') ?? 'Player';
    const user: StoredUser & { createdAt: number } = {
      id: randomUUID(),
      email,
      name,
      passwordHash: null,
      googleSub: payload.sub,
      createdAt: Date.now(),
    };
    await this.store.insertUser(user);
    return publicUser(user);
  }

  async rename(userId: string, nameInput: string): Promise<PublicUser> {
    const name = normalizeName(nameInput);
    if (!name) throw new AuthError(400, 'Name must be 1–20 characters.');
    const user = await this.store.findUserById(userId);
    if (!user) throw new AuthError(401, 'Sign in again.');
    await this.store.updateName(userId, name, Date.now());
    return { ...publicUser(user), name };
  }

  async createSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.store.insertSession(hashToken(token), userId, Date.now() + SESSION_MS);
    return token;
  }

  async userForToken(token: string | undefined): Promise<PublicUser | null> {
    if (!token) return null;
    const found = await this.store.findSessionUser(hashToken(token));
    if (!found) return null;
    if (found.expiresAt <= Date.now()) {
      await this.store.deleteSession(hashToken(token));
      return null;
    }
    return publicUser(found.user);
  }

  async revoke(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.store.deleteSession(hashToken(token));
  }
}
