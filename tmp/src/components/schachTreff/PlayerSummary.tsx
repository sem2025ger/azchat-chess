import { useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from '../../services/supabase';
import { useSchachTreffCopy } from './copy';
type Summary = { completed_games: number; last_games: { opponent: string | null; time_control: string; result: string }[] };
export default function PlayerSummary({ userId,children }: { userId: string; children: ReactNode }) {
  const t=useSchachTreffCopy();
  const [state,setState]=useState<{ userId: string; data?: Summary; error?: boolean; missing?: boolean } | null>(null);
  const warned=useRef(false);
  useEffect(() => {
    let current=true; const abort=new AbortController();
    void supabase.rpc('club_player_summary',{p_user:userId}).abortSignal(abort.signal).then(result => {
      if (!current) return;
      if (result.error && ['PGRST202','42883'].includes(result.error.code)) {
        if (!warned.current) { warned.current=true; console.warn('Schach-Treff player summary unavailable:',result.error.code); }
        setState({userId,missing:true});
      } else if (result.error || !Number.isFinite(result.data?.completed_games) || !Array.isArray(result.data?.last_games)) setState({userId,error:true});
      else setState({userId,data:result.data as Summary});
    },() => { if (current) setState({userId,error:true}); });
    return () => { current=false; abort.abort(); };
  },[userId]);
  const data=state?.userId===userId ? state.data : undefined;
  const error=state?.userId===userId && state.error;
  return <>{children}{state?.userId===userId && state.missing ? null : error ? <p role="alert">{t.error}</p> : !data ? <p role="status">{t.loading}</p> : <>
    <p>{t.games}: <span className="st-mono">{data.completed_games}</span></p><h3>{t.lastGames}</h3>
    {!data.last_games.length && <p>{t.noGames}</p>}<ul>{data.last_games.map((game,index) => <li key={index}>{game.opponent ?? '—'} · <span className="st-mono">{game.time_control} · {game.result}</span></li>)}</ul>
  </>}</>;
}
