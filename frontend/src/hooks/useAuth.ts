import { useCallback, useEffect, useState } from 'react';
import {
  fetchAuthConfig,
  fetchSession,
  loginAccount,
  loginWithGoogle,
  logoutAccount,
  registerAccount,
  saveAccountName,
  type AuthUser,
} from '../services/authApi.js';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSession().catch(() => ({ user: null })),
      fetchAuthConfig().catch(() => ({ googleClientId: null })),
    ]).then(([session, config]) => {
      if (cancelled) return;
      setUser(session.user);
      setGoogleClientId(config.googleClientId);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const result = await registerAccount(name, email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginAccount(email, password);
    setUser(result.user);
    return result.user;
  }, []);

  const loginGoogle = useCallback(async (credential: string) => {
    const result = await loginWithGoogle(credential);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  const saveName = useCallback(async (name: string) => {
    const result = await saveAccountName(name);
    setUser(result.user);
    return result.user;
  }, []);

  return { user, ready, googleClientId, register, login, loginGoogle, logout, saveName };
}
