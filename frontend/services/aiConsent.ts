import axios from 'axios';
import { API_URL } from './config';

let requestConsent: ((token: string) => Promise<boolean>) | null = null;
const pending = new Map<string, Promise<void>>();
export function setAIConsentPrompt(prompt: ((token: string) => Promise<boolean>) | null) { requestConsent = prompt; }

export function ensureAIConsent(token: string): Promise<void> {
  const existing = pending.get(token);
  if (existing) return existing;
  const operation = (async () => {
    const options = { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 };
    const profile = await axios.get(`${API_URL}/api/auth/profile`, options);
    if (profile.data.ai_consent_at) return;
    if (!requestConsent || !await requestConsent(token)) throw new Error('AI analysis cancelled. Your image was not sent for analysis.');
    await axios.post(`${API_URL}/api/auth/ai-consent`, { accepted: true }, options);
  })();
  pending.set(token, operation);
  void operation.finally(() => { if (pending.get(token) === operation) pending.delete(token); }).catch(() => {});
  return operation;
}

export function isAIRequest(url: string, method = 'get') {
  return method.toLowerCase() === 'post' && url.startsWith(`${API_URL}/api/`) &&
    /\/(scan[^/]*|identify-asset|analyze[^/]*|vastu)(?:\?|$)/.test(url);
}
