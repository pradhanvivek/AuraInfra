import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { secureAuthStorage } from '../utils/secureAuthStorage';
import { requireApiUrl } from '../services/config';

interface AuthContextType {
  token: string | null;
  userId: string | null;
  username: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<string>;
  register: (username: string, email: string, password: string, property_ids?: string[]) => Promise<void>;
  logout: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const activeToken = useRef<string | null>(null);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const enqueue = useCallback((operation: () => Promise<void>) => {
    const next = writes.current.catch(() => {}).then(operation);
    writes.current = next;
    return next;
  }, []);

  const clearAuth = useCallback(async () => {
    generation.current += 1;
    activeToken.current = null;
    setTokenState(null); setUserId(null); setUsername(null);
    await enqueue(async () => {
      await secureAuthStorage.multiRemove(['token', 'userId', 'username', 'oauth_pending']);
      // Do not carry a previous account's community selection to the next account.
      const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
      await AsyncStorage.multiRemove(['selectedProperty', 'disclaimer_checked_session']);
    });
  }, [enqueue]);

  const storeAuth = useCallback(async (newToken: string, id: string, name: string, expected: number) => {
    await enqueue(async () => {
      if (generation.current !== expected) throw new Error('Sign-in was cancelled. Please try again.');
      // Token is the commit marker; interrupted writes cannot restore a new token
      // alongside the previous account's identifiers.
      await secureAuthStorage.removeItem('token');
      await secureAuthStorage.setItem('userId', id);
      await secureAuthStorage.setItem('username', name);
      await secureAuthStorage.setItem('token', newToken);
      if (generation.current !== expected) throw new Error('Sign-in was cancelled. Please try again.');
      activeToken.current = newToken;
      setTokenState(newToken); setUserId(id); setUsername(name);
    });
  }, [enqueue]);

  useEffect(() => {
    let active = true;
    const expected = generation.current;
    const load = async () => {
      try {
        const stored = await secureAuthStorage.getItem('token');
        if (!stored || stored === 'null') return;
        try {
          const profile = await axios.get(`${requireApiUrl()}/api/auth/profile`, {
            headers: { Authorization: `Bearer ${stored}` }, timeout: 10000,
          });
          if (active) await storeAuth(stored, profile.data.id, profile.data.username, expected);
        } catch (error: any) {
          if (!active || generation.current !== expected) return;
          if (error.response?.status === 401 || error.response?.status === 403) {
            await clearAuth();
          } else {
            // An offline launch does not erase a valid local session.
            const [id, name] = await Promise.all([
              secureAuthStorage.getItem('userId'), secureAuthStorage.getItem('username'),
            ]);
            if (active && generation.current === expected) {
              activeToken.current = stored;
              setTokenState(stored); setUserId(id); setUsername(name);
            }
          }
        }
      } finally { if (active) setLoading(false); }
    };
    void load().catch(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clearAuth, storeAuth]);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(response => response, async error => {
      if (token && activeToken.current === token && error.response?.status === 401 &&
          error.config?.headers?.Authorization === `Bearer ${token}` &&
          error.config?.url?.startsWith(`${requireApiUrl()}/api/`) &&
          !error.config?.url?.endsWith('/auth/account') && !error.config?.url?.endsWith('/auth/logout')) {
        await clearAuth();
      }
      return Promise.reject(error);
    });
    return () => axios.interceptors.response.eject(interceptor);
  }, [token, clearAuth]);

  const login = async (name: string, password: string) => {
    const expected = generation.current;
    try {
      const response = await axios.post(`${requireApiUrl()}/api/auth/login`, { username: name, password }, { timeout: 15000 });
      await storeAuth(response.data.access_token, response.data.user_id, response.data.username, expected);
      return response.data.access_token;
    } catch (error: any) { throw new Error(error.response?.data?.detail || error.message || 'Login failed'); }
  };

  const register = async (name: string, email: string, password: string, property_ids: string[] = []) => {
    const expected = generation.current;
    try {
      const response = await axios.post(`${requireApiUrl()}/api/auth/register`, { username: name, email, password, property_ids }, { timeout: 15000 });
      await storeAuth(response.data.access_token, response.data.user_id, response.data.username, expected);
    } catch (error: any) { throw new Error(error.response?.data?.detail || error.message || 'Registration failed'); }
  };

  const logout = async () => {
    const previousToken = token;
    await clearAuth();
    try {
      if (previousToken) await axios.post(`${requireApiUrl()}/api/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${previousToken}` }, timeout: 10000,
      });
    } catch { /* Always clear local credentials, including when offline. */ }

  };

  const setToken = useCallback(async (newToken: string) => {
    const expected = generation.current;
    const profile = await axios.get(`${requireApiUrl()}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${newToken}` }, timeout: 10000,
    });
    await storeAuth(newToken, profile.data.id, profile.data.username, expected);
  }, [storeAuth]);

  return <AuthContext.Provider value={{ token, userId, username, loading, login, register, logout, setToken }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
