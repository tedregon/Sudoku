import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL
);
`;

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  googleSub: string | null;
};

interface SqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): {
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  google_sub: string | null;
};

function toUser(row: UserRow | undefined | null): StoredUser | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    googleSub: row.google_sub,
  };
}

export interface AuthStore {
  kind: 'sqlite' | 'postgres';
  migrate(): Promise<void>;
  findUserById(id: string): Promise<StoredUser | null>;
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserByGoogleSub(sub: string): Promise<StoredUser | null>;
  insertUser(user: StoredUser & { createdAt: number }): Promise<void>;
  updateName(id: string, name: string, updatedAt: number): Promise<void>;
  linkGoogle(id: string, googleSub: string, updatedAt: number): Promise<void>;
  insertSession(tokenHash: string, userId: string, expiresAt: number): Promise<void>;
  findSessionUser(tokenHash: string): Promise<{ user: StoredUser; expiresAt: number } | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

class SqliteAuthStore implements AuthStore {
  kind = 'sqlite' as const;

  constructor(private db: SqliteDatabase) {}

  async migrate(): Promise<void> {
    this.db.exec('PRAGMA foreign_keys = ON');
    this.db.exec(SCHEMA);
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const row = this.db.prepare(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE id = ?',
    ).get(id) as UserRow | undefined;
    return toUser(row);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const row = this.db.prepare(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE email = ?',
    ).get(email) as UserRow | undefined;
    return toUser(row);
  }

  async findUserByGoogleSub(sub: string): Promise<StoredUser | null> {
    const row = this.db.prepare(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE google_sub = ?',
    ).get(sub) as UserRow | undefined;
    return toUser(row);
  }

  async insertUser(user: StoredUser & { createdAt: number }): Promise<void> {
    this.db.prepare(
      `INSERT INTO users (id, email, name, password_hash, google_sub, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(user.id, user.email, user.name, user.passwordHash, user.googleSub, user.createdAt, user.createdAt);
  }

  async updateName(id: string, name: string, updatedAt: number): Promise<void> {
    this.db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name, updatedAt, id);
  }

  async linkGoogle(id: string, googleSub: string, updatedAt: number): Promise<void> {
    this.db.prepare('UPDATE users SET google_sub = ?, updated_at = ? WHERE id = ?').run(googleSub, updatedAt, id);
  }

  async insertSession(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    this.db.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).run(tokenHash, userId, expiresAt);
  }

  async findSessionUser(tokenHash: string): Promise<{ user: StoredUser; expiresAt: number } | null> {
    const row = this.db.prepare(
      `SELECT u.id, u.email, u.name, u.password_hash, u.google_sub, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    ).get(tokenHash) as (UserRow & { expires_at: number }) | undefined;
    if (!row) return null;
    const user = toUser(row);
    if (!user) return null;
    return { user, expiresAt: Number(row.expires_at) };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }
}

class PostgresAuthStore implements AuthStore {
  kind = 'postgres' as const;

  constructor(private pool: pg.Pool) {}

  async migrate(): Promise<void> {
    await this.pool.query(SCHEMA);
  }

  async findUserById(id: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE id = $1',
      [id],
    );
    return toUser(result.rows[0]);
  }

  async findUserByEmail(email: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE email = $1',
      [email],
    );
    return toUser(result.rows[0]);
  }

  async findUserByGoogleSub(sub: string): Promise<StoredUser | null> {
    const result = await this.pool.query<UserRow>(
      'SELECT id, email, name, password_hash, google_sub FROM users WHERE google_sub = $1',
      [sub],
    );
    return toUser(result.rows[0]);
  }

  async insertUser(user: StoredUser & { createdAt: number }): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, email, name, password_hash, google_sub, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, user.email, user.name, user.passwordHash, user.googleSub, user.createdAt, user.createdAt],
    );
  }

  async updateName(id: string, name: string, updatedAt: number): Promise<void> {
    await this.pool.query(
      'UPDATE users SET name = $1, updated_at = $2 WHERE id = $3',
      [name, updatedAt, id],
    );
  }

  async linkGoogle(id: string, googleSub: string, updatedAt: number): Promise<void> {
    await this.pool.query(
      'UPDATE users SET google_sub = $1, updated_at = $2 WHERE id = $3',
      [googleSub, updatedAt, id],
    );
  }

  async insertSession(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    await this.pool.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
      [tokenHash, userId, expiresAt],
    );
  }

  async findSessionUser(tokenHash: string): Promise<{ user: StoredUser; expiresAt: number } | null> {
    const result = await this.pool.query<UserRow & { expires_at: string | number }>(
      `SELECT u.id, u.email, u.name, u.password_hash, u.google_sub, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    const user = toUser(row);
    if (!user) return null;
    return { user, expiresAt: Number(row.expires_at) };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }
}

function sqlitePath(): string {
  return process.env.SQLITE_PATH || join(process.cwd(), 'data', 'accounts.sqlite');
}

export async function openAuthStore(): Promise<AuthStore> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const pool = new pg.Pool({
      connectionString: databaseUrl,
      ssl: /localhost|127\.0\.0\.1/.test(databaseUrl) ? undefined : { rejectUnauthorized: false },
    });
    const store = new PostgresAuthStore(pool);
    await store.migrate();
    console.log('Auth store: postgres');
    return store;
  }

  const path = sqlitePath();
  mkdirSync(dirname(path), { recursive: true });
  let db: SqliteDatabase;
  try {
    const sqlite = await import('node:sqlite');
    db = new sqlite.DatabaseSync(path);
  } catch {
    throw new Error('Set DATABASE_URL to a Postgres database, or run the API on Node.js 22.5 or newer for the local account file.');
  }
  const store = new SqliteAuthStore(db);
  await store.migrate();
  console.log(`Auth store: sqlite (${path})`);
  return store;
}
