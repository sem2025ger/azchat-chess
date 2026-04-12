import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://mock.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'mock-key';

// Using SERVICE_KEY bypasses RLS for authoritative server updates.
export const supabase = createClient(supabaseUrl, supabaseKey);

export async function createMatch(roomId, whiteId, blackId, fen, timeControl) {
  console.log(`[Supabase] Creating match ${roomId}`);
  const { data, error } = await supabase
    .from('matches')
    .insert({
      id: roomId,
      white_id: whiteId,
      black_id: blackId,
      fen: fen,
      status: 'active',
      time_control: timeControl,
      initial_time: 600, // 10 minutes default
    })
    .select()
    .single();
    
  if (error) console.error("[DB ERROR] createMatch:", error.message);
  return data;
}

export async function recordMove(matchId, playerId, moveSan, moveNumber, fenAfter) {
  console.log(`[Supabase] Recording move ${moveNumber} in match ${matchId}`);
  const { error } = await supabase
    .from('moves')
    .insert({
      match_id: matchId,
      player_id: playerId,
      move_san: moveSan,
      move_number: moveNumber,
      fen_after: fenAfter,
    });
    
  if (error) console.error("[DB ERROR] recordMove:", error.message);
  
  // Update the match FEN state as well
  await supabase
    .from('matches')
    .update({ fen: fenAfter })
    .eq('id', matchId);
}

export async function resolveMatch(matchId, winnerId, reason) {
  console.log(`[Supabase] Resolving match ${matchId}. Winner: ${winnerId}`);
  const { error } = await supabase
    .from('matches')
    .update({ 
      status: reason === 'draw' ? 'draw' : 'completed', 
      winner_id: winnerId,
      completed_at: new Date().toISOString()
    })
    .eq('id', matchId);
    
  if (error) console.error("[DB ERROR] resolveMatch:", error.message);
}

export async function persistGameState(roomId, gameData) {
  // Legacy fast-update fallback
  await supabase
    .from('matches')
    .update({ fen: gameData.chess.fen() })
    .eq('id', roomId);
}
