export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

function apiBase(): string {
  const configured = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, '');
  if (import.meta.env.PROD) {
    return window.location.origin.replace('sudoku-frontend', 'sudoku-backend');
  }
  return '';
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || 'Request failed.');
  }
  return data;
}

export function fetchSession(): Promise<{ user: AuthUser | null }> {
  return request('/api/auth/me');
}

export function fetchAuthConfig(): Promise<{ googleClientId: string | null }> {
  return request('/api/auth/config');
}

export function registerAccount(name: string, email: string, password: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
}

export function loginAccount(email: string, password: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
}

export function logoutAccount(): Promise<{ user: null }> {
  return request('/api/auth/logout', { method: 'POST' });
}

export function saveAccountName(name: string): Promise<{ user: AuthUser }> {
  return request('/api/auth/name', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}
