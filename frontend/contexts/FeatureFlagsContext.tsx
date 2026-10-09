import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { API_URL } from '../services/config';
import { disabledFlags, parseModuleFlags, type ModuleFlags } from '../utils/moduleFlags';

type State = { flags: ModuleFlags; loading: boolean; error: boolean; refresh: () => Promise<void> };
const Context = createContext<State>({ flags: disabledFlags, loading: true, error: false, refresh: async () => {} });
export const useFeatureFlags = () => useContext(Context);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [state, setState] = useState<{ token: string | null; flags: ModuleFlags; loading: boolean; error: boolean }>({
    token: null, flags: disabledFlags, loading: true, error: false,
  });
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    if (!token) return;
    const request = ++generation.current;
    try {
      const response = await axios.get(`${API_URL}/api/app-config`, {
        headers: { Authorization: `Bearer ${token}` }, timeout: 10000,
      });
      const flags = parseModuleFlags(response.data);
      if (request === generation.current) setState({ token, flags, loading: false, error: false });
    } catch {
      // No persistent cache: stale flags cannot enable a module after logout or a failed refresh.
      if (request === generation.current) setState({ token, flags: disabledFlags, loading: false, error: true });
    }
  }, [token]);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const listener = AppState.addEventListener('change', next => { if (next === 'active') void refresh(); });
    return () => { generation.current++; clearInterval(interval); listener.remove(); };
  }, [refresh]);
  const current = !token ? { flags: disabledFlags, loading: false, error: false }
    : state.token === token ? state : { flags: disabledFlags, loading: true, error: false };
  return <Context.Provider value={{ ...current, refresh }}>{children}</Context.Provider>;
}
