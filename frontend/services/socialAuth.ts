import 'react-native-get-random-values';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import axios from 'axios';
import { secureAuthStorage } from '../utils/secureAuthStorage';
import { requireApiUrl } from './config';

type PendingAuth = { state: string; createdAt: number; expectedUserId?: string; purpose: 'login' | 'delete' };
export type AuthResult = { access_token: string; user_id: string; username: string };

let nativeGoogleAuthActive = false;
export function isNativeGoogleAuthActive() { return nativeGoogleAuthActive; }

function randomState() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export async function finishGoogleCallback(url: string): Promise<{ auth: AuthResult; pending: PendingAuth }> {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const state = parsed.searchParams.get('oauth_state') || fragment.get('oauth_state');
  const sessionId = fragment.get('session_id') || parsed.searchParams.get('session_id');
  const stored = await secureAuthStorage.getItem('oauth_pending');
  if (!stored) throw new Error('Please start sign-in again.');
  const pending: PendingAuth = JSON.parse(stored);
  if (state !== pending.state || Date.now() - pending.createdAt > 5 * 60 * 1000 || !sessionId) {
    throw new Error('This sign-in response has expired or does not match your request.');
  }
  await secureAuthStorage.removeItem('oauth_pending');
  const response = await axios.post<AuthResult>(`${requireApiUrl()}/api/auth/session`, {}, {
    headers: { 'X-Session-ID': sessionId }, timeout: 15000,
  });
  if (pending.expectedUserId && response.data.user_id !== pending.expectedUserId) {
    throw new Error('Sign in with the same account you want to delete.');
  }
  return { auth: response.data, pending };
}

export async function signInGoogle(expectedUserId?: string): Promise<AuthResult | null> {
  requireApiUrl();
  const pending: PendingAuth = { state: randomState(), createdAt: Date.now(), expectedUserId,
    purpose: expectedUserId ? 'delete' : 'login' };
  await secureAuthStorage.setItem('oauth_pending', JSON.stringify(pending));
  const redirect = Platform.OS === 'web'
    ? `${window.location.origin}/auth/login?oauth_state=${pending.state}`
    : `aurainfra://auth/login?oauth_state=${pending.state}`;
  const authOrigin = process.env.EXPO_PUBLIC_AUTH_URL || 'https://auth.emergentagent.com';
  const url = `${authOrigin}/?redirect=${encodeURIComponent(redirect)}`;
  if (Platform.OS === 'web') {
    window.location.assign(url);
    return null;
  }
  nativeGoogleAuthActive = true;
  try {
    const result = await WebBrowser.openAuthSessionAsync(url, redirect);
    if (result.type !== 'success') {
      await secureAuthStorage.removeItem('oauth_pending');
      return null;
    }
    return (await finishGoogleCallback(result.url)).auth;
  } catch (error) {
    await secureAuthStorage.removeItem('oauth_pending');
    throw error;
  } finally { nativeGoogleAuthActive = false; }
}

export async function signInApple(expectedUserId?: string): Promise<AuthResult> {
  const challenge = await axios.post(`${requireApiUrl()}/api/auth/apple/challenge`);
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL], nonce: challenge.data.nonce,
  });
  if (!credential.identityToken || !credential.authorizationCode) throw new Error('Apple did not return an authentication credential.');
  const response = await axios.post<AuthResult>(`${requireApiUrl()}/api/auth/apple`, {
    identity_token: credential.identityToken, authorization_code: credential.authorizationCode, nonce: challenge.data.nonce,
  }, { timeout: 20000 });
  if (expectedUserId && response.data.user_id !== expectedUserId) throw new Error('Sign in with the same account you want to delete.');
  return response.data;
}
