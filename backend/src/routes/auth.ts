import { Router, type Request, type Response } from 'express';
import { AuthError, AuthService, googleClientId, type PublicUser } from '../auth/service.js';

const COOKIE = 'sudoku_session';

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (rawKey === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

function clientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response): boolean => {
    const now = Date.now();
    const key = clientIp(req);
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    if (current.count > limit) {
      res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
      return false;
    }
    return true;
  };
}

async function sendAuthError(res: Response, error: unknown): Promise<void> {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
}

export function createAuthRouter(auth: AuthService): Router {
  const router = Router();
  const limitAuth = rateLimiter(20, 15 * 60 * 1000);

  router.get('/config', (_req, res) => {
    res.json({ googleClientId: googleClientId() });
  });

  router.get('/me', async (req, res) => {
    const user = await auth.userForToken(readCookie(req.headers.cookie, COOKIE));
    res.json({ user });
  });

  router.post('/register', async (req, res) => {
    if (!limitAuth(req, res)) return;
    try {
      const user = await auth.register(
        String(req.body?.name ?? ''),
        String(req.body?.email ?? ''),
        String(req.body?.password ?? ''),
      );
      await startSession(auth, res, user);
    } catch (error) {
      await sendAuthError(res, error);
    }
  });

  router.post('/login', async (req, res) => {
    if (!limitAuth(req, res)) return;
    try {
      const user = await auth.login(String(req.body?.email ?? ''), String(req.body?.password ?? ''));
      await startSession(auth, res, user);
    } catch (error) {
      await sendAuthError(res, error);
    }
  });

  router.post('/google', async (req, res) => {
    if (!limitAuth(req, res)) return;
    try {
      const user = await auth.signInWithGoogle(String(req.body?.credential ?? ''));
      await startSession(auth, res, user);
    } catch (error) {
      await sendAuthError(res, error);
    }
  });

  router.post('/logout', async (req, res) => {
    await auth.revoke(readCookie(req.headers.cookie, COOKIE));
    res.clearCookie(COOKIE, cookieOptions());
    res.json({ user: null });
  });

  router.patch('/name', async (req, res) => {
    try {
      const current = await auth.userForToken(readCookie(req.headers.cookie, COOKIE));
      if (!current) {
        res.status(401).json({ error: 'Sign in again.' });
        return;
      }
      const user = await auth.rename(current.id, String(req.body?.name ?? ''));
      res.json({ user });
    } catch (error) {
      await sendAuthError(res, error);
    }
  });

  return router;
}

async function startSession(auth: AuthService, res: Response, user: PublicUser): Promise<void> {
  const token = await auth.createSession(user.id);
  res.cookie(COOKIE, token, cookieOptions());
  res.json({ user });
}
