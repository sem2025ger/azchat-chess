import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

if (supabaseUrl === 'https://mock-url.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
  console.error("FATAL: VITE_SUPABASE_URL is missing. Please create tmp/.env and define it.");
}

// Capture the one-time recovery intent before the auth client consumes URL tokens.
// Store only a timestamp, never credentials or email addresses.
const RECOVERY_INTENT_KEY = 'chessaz:password-recovery-entry';
const RECOVERY_INTENT_TTL_MS = 15 * 60 * 1000;
let inMemoryRecoveryIntent = 0;

function markPasswordRecoveryIntent() {
  inMemoryRecoveryIntent = Date.now();
  try { sessionStorage.setItem(RECOVERY_INTENT_KEY, String(inMemoryRecoveryIntent)); } catch { /* storage may be disabled */ }
}

export function hasPasswordRecoveryIntent(): boolean {
  let markedAt = inMemoryRecoveryIntent;
  try { markedAt = Math.max(markedAt, Number(sessionStorage.getItem(RECOVERY_INTENT_KEY)) || 0); } catch { /* storage may be disabled */ }
  return markedAt > 0 && Date.now() - markedAt < RECOVERY_INTENT_TTL_MS;
}

export function clearPasswordRecoveryIntent() {
  inMemoryRecoveryIntent = 0;
  try { sessionStorage.removeItem(RECOVERY_INTENT_KEY); } catch { /* storage may be disabled */ }
}

if (typeof window !== 'undefined') {
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const isRecoveryLink = fragment.get('type') === 'recovery' &&
    fragment.has('access_token') && fragment.has('refresh_token');
  if (isRecoveryLink) markPasswordRecoveryIntent();
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// This listener is registered during client creation, before lazy screens mount.
// A screen-local listener alone may miss PASSWORD_RECOVERY on a cold email redirect.
supabase.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') markPasswordRecoveryIntent();
  if (event === 'SIGNED_OUT') clearPasswordRecoveryIntent();
});

export interface UserProfile {
  id: string;
  username: string;
  ratingBlitz: number;
  ratingRapid: number;
  ratingBullet: number;
  countryCode: string;
  role: string;
  createdAt?: string;
  rating_blitz?: number;
  rating_rapid?: number;
  rating_bullet?: number;
  country_code?: string;
  created_at?: string;
}

export interface GamePersistence {
  id: string;
  fen: string;
  pgn: string;
  white_id: string;
  black_id: string;
  winner: string | null;
  status: 'active' | 'completed' | 'abandoned';
  time_control: string;
}
