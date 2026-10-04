import Constants from 'expo-constants';
import axios from 'axios';

// Bound ordinary requests; AI endpoints supply their own longer timeouts.
axios.defaults.timeout = 20000;

// Keep the same endpoint for authentication and every feature screen.
export const API_URL = (process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

export function requireApiUrl() {
  if (!API_URL) throw new Error('The server address is missing. Please contact support.');
  return API_URL;
}
