import { createClient } from '@supabase/supabase-js';
import { recoveryCallbackDestination } from '../utils/authFlow';
import { observePasswordRecovery } from '../utils/authRecovery';

// Normalize before creating the SDK client: it consumes/clears successful URL
// fragments during initialization, potentially before React has mounted.
if (typeof window !== 'undefined') {
  const destination = recoveryCallbackDestination(window.location.href);
  if (destination) window.history.replaceState(window.history.state, '', destination);
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

if (supabaseUrl === 'https://mock-url.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
  console.error("FATAL: VITE_SUPABASE_URL is missing. Please create tmp/.env and define it.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const passwordRecovery = observePasswordRecovery(supabase.auth);

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
