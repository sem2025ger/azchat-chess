import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, History, RefreshCw } from 'lucide-react';
import { fetchAnalysisGame, fetchAnalysisGames, type AnalysisGameSummary } from '../../services/analysisGames';
import type { AnalysisLoad } from '../../utils/analysisWorkspace';
import type { AnalysisWords } from './copy';

export default function SavedGamesPanel({ userId, words, language, onLoad }: {
  userId?: string; words: AnalysisWords; language: string;
  onLoad: (analysis: AnalysisLoad, title: string) => void;
}) {
  const [games, setGames] = useState<AnalysisGameSummary[]>([]);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<'list' | 'game' | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const openRequest = useRef<AbortController | null>(null);
  useEffect(() => () => openRequest.current?.abort(), []);
  useEffect(() => {
    if (!userId) return;
    const request = new AbortController();
    setLoading(true); setError(null);
    fetchAnalysisGames(userId, page, request.signal).then(result => {
      if (request.signal.aborted) return;
      setGames(previous => page === 0 ? result.games : [...previous, ...result.games.filter(game => !previous.some(item => item.id === game.id))]);
      setHasMore(result.hasMore);
    }).catch(() => { if (!request.signal.aborted) setError('list'); })
      .finally(() => { if (!request.signal.aborted) setLoading(false); });
    return () => request.abort();
  }, [userId, page, refresh]);

  const open = async (game: AnalysisGameSummary) => {
    if (!userId || opening) return;
    const request = new AbortController();
    openRequest.current?.abort(); openRequest.current = request;
    setOpening(game.id); setError(null);
    try {
      const analysis = await fetchAnalysisGame(userId, game.id, request.signal);
      if (!request.signal.aborted) onLoad(analysis, `${game.white_profile?.username || words.guest} — ${game.black_profile?.username || words.guest}`);
    } catch { if (!request.signal.aborted) setError('game'); }
    finally { if (!request.signal.aborted) setOpening(null); }
  };
  if (!userId) return <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-neutral-400"><Link to="/profile" className="rounded-lg px-3 py-2 text-amber-100 underline decoration-amber-200/30 underline-offset-4">{words.signIn}</Link></div>;
  return <section aria-label={words.games} className="flex min-h-0 flex-1 flex-col">
    <header className="flex items-start justify-between gap-3 border-b border-white/5 p-4">
      <div><h2 className="text-sm font-bold text-amber-100">{words.recent}</h2><p className="mt-1 text-xs leading-relaxed text-neutral-400">{words.gamesInfo}</p></div>
      <button type="button" aria-label={words.refresh} title={words.refresh} disabled={loading || !!opening} onClick={() => { setPage(0); setRefresh(value => value + 1); }} className="analysis-tool-button shrink-0"><RefreshCw size={16} /></button>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-3" aria-busy={loading || !!opening}>
      {error && <div role="alert" className="mb-3 rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-xs text-red-200">{error === 'game' ? words.gameError : words.loadError}{error === 'list' && <button type="button" onClick={() => setRefresh(value => value + 1)} className="ml-2 underline">{words.retry}</button>}</div>}
      {!loading && !error && games.length === 0 && <div className="flex flex-col items-center gap-3 px-5 py-12 text-center"><History size={28} className="text-amber-200/40" /><h3 className="text-sm font-bold text-neutral-200">{words.empty}</h3><p className="text-xs leading-relaxed text-neutral-500">{words.emptyInfo}</p></div>}
      <div className="space-y-2">{games.map(game => {
        const color = game.white_id === userId ? 'w' : 'b';
        const outcome = game.result === '1/2-1/2' ? 'draw' : (game.result === '1-0') === (color === 'w') ? 'win' : 'loss';
        const date = new Date(game.completed_at);
        return <button key={game.id} type="button" onClick={() => void open(game)} disabled={!!opening} className="group w-full rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-left transition-colors hover:border-amber-200/30 hover:bg-amber-200/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-200 disabled:opacity-50">
          <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-bold text-neutral-200">{(color === 'w' ? game.black_profile : game.white_profile)?.username || words.guest}</span><span className={`text-[11px] font-bold ${outcome === 'win' ? 'text-emerald-300' : outcome === 'loss' ? 'text-red-300' : 'text-neutral-400'}`}>{words[outcome]}</span></div>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-neutral-500"><span>{color === 'w' ? words.white : words.black}</span><span>·</span><span>{game.time_control}</span><span className="ml-auto">{Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(language === 'ua' ? 'uk' : language, { day:'numeric', month:'short', year:'numeric' })}</span></div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-200/70">{opening === game.id ? words.loading : words.open}<ChevronRight size={13} /></div>
        </button>;
      })}</div>
      {loading && <p role="status" className="py-5 text-center text-xs text-neutral-400">{words.loading}</p>}
      {hasMore && !loading && !error && <button type="button" onClick={() => setPage(value => value + 1)} className="analysis-tool-button mt-3 w-full">{words.more}</button>}
    </div>
  </section>;
}
