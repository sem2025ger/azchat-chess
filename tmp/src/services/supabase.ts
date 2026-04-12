import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://mock-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'mock-anon-key';

if (supabaseUrl === 'https://mock-url.supabase.co' || !import.meta.env.VITE_SUPABASE_URL) {
  console.error("FATAL: VITE_SUPABASE_URL is missing. Please create tmp/.env and define it.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  username: string;
  ratingBlitz: number;
  ratingRapid: number;
  ratingBullet: number;
  countryCode: string;
  role: string;
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
