import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { gamesRequest, GamesApiError, type GamesStatus, type MastersResult, type SourceGame } from '../../services/gamesDatabase';
import { analysisFromPgn, type AnalysisLoad } from '../../utils/analysisWorkspace';
import SavedGamesPanel from './SavedGamesPanel';
import type { AnalysisWords } from './copy';

export default function GamesLibraryPanel({ userId, language, words, fen, onLoad }: {
  userId?: string; language: string; words: AnalysisWords; fen: string;
  onLoad: (analysis: AnalysisLoad, title: string, details?: { white: string; black: string }) => void;
}) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={t('games.tab')}>
    <div className="flex shrink-0 gap-2 border-b border-white/10 p-2">
      {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={saved === value} onClick={() => setSaved(value)} className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 text-xs font-semibold ${saved === value ? 'bg-white/10 text-amber-100' : 'text-neutral-400'}`}>{t(value ? 'games.saved' : 'games.sources')}</button>)}
    </div>
    {saved ? <SavedGamesPanel userId={userId} language={language} words={words} onLoad={onLoad} /> : <SourceGamesPanel fen={fen} onLoad={onLoad} />}
  </section>;
}

function SourceGamesPanel({ fen, onLoad }: { fen: string; onLoad: (analysis: AnalysisLoad, title: string, details: { white: string; black: string }) => void }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<GamesStatus | null>(null);
  const [data, setData] = useState<MastersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<GamesApiError | null>(null);
  const [retry, setRetry] = useState(0);
  const [opening, setOpening] = useState(false);
  const openRequest = useRef<AbortController | null>(null);
  const normalizedFen = fen.split(' ').slice(0, 4).join(' ');
  useEffect(() => () => openRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const next = await gamesRequest<GamesStatus>('/status', controller.signal);
          if (controller.signal.aborted) return;
          setStatus(next);
          if (!next.lichess) throw new GamesApiError('FEATURE_DISABLED');
          const result = await gamesRequest<MastersResult>('/masters?' + new URLSearchParams({ fen: normalizedFen + ' 0 1' }), controller.signal);
          if (!controller.signal.aborted) setData(result);
        } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
        finally { if (!controller.signal.aborted) setLoading(false); }
      })();
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalizedFen, retry]);
  const open = async (game: SourceGame) => {
    if (opening) return;
    const controller = new AbortController(); openRequest.current = controller;
    setOpening(true); setError(null);
    try {
      const result = await gamesRequest<{ pgn: string }>(`/masters/${game.id}/pgn`, controller.signal);
      const analysis = analysisFromPgn(result.pgn);
      if (!controller.signal.aborted) onLoad(analysis, `${game.white.name} — ${game.black.name}`, { white: game.white.name, black: game.black.name });
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
    finally { if (!controller.signal.aborted) setOpening(false); }
  };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="shrink-0 p-3"><h2 className="text-sm font-semibold text-amber-100">{t('games.position')}</h2></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 text-xs" aria-busy={loading || opening}>
      {loading && <div role="status" className="animate-pulse space-y-3"><p>{t('games.loading')}</p>{[0,1,2].map(i => <div key={i} className="h-10 rounded-lg bg-white/5" />)}</div>}
      {error && <div role="alert" className="mb-3 rounded-lg border border-red-300/25 p-3 text-red-200"><p>{t(`games.error.${error.code}`)}{error.retryAfter > 0 && ` · ${error.retryAfter} ${t('games.seconds')}`}</p><button type="button" className="mt-2 min-h-9 underline" onClick={() => setRetry(x => x + 1)}>{t('games.retry')}</button></div>}
      {!loading && !error && data && <>
        {!data.moves.length && !data.topGames.length && <p className="py-5 text-neutral-400">{t('games.emptyPosition')}</p>}
        <div className="space-y-2">{data.moves.map(move => <div key={move.uci} className="rounded-lg border border-white/10 p-2"><div className="mb-1 flex justify-between"><strong>{move.san}</strong><span>{move.games.toLocaleString()} {t('games.count')}</span></div><div className="flex h-2 overflow-hidden rounded" aria-label={`${t('game.white')} ${move.white}, ${t('games.draws')} ${move.draws}, ${t('game.black')} ${move.black}`}><span className="bg-neutral-100" style={{width:`${move.games ? move.white / move.games * 100 : 0}%`}} /><span className="bg-neutral-500" style={{width:`${move.games ? move.draws / move.games * 100 : 0}%`}} /><span className="bg-neutral-800" style={{width:`${move.games ? move.black / move.games * 100 : 0}%`}} /></div></div>)}</div>
        <h3 className="mb-2 mt-5 font-bold text-amber-100">{t('games.top')}</h3>
        <GameRows games={data.topGames} opening={opening} onOpen={open} />
        <h3 className="mb-2 mt-4 font-bold text-amber-100">{t('games.recent')}</h3><p className="text-neutral-400">{t('games.noRecentMasters')}</p>
      </>}
      <p className="mt-5 border-t border-white/10 pt-3 text-neutral-400"><a href="https://lichess.org" target="_blank" rel="noopener noreferrer">{t('games.attributionMasters')}</a></p>
      {status && !status.lichess && <p className="mt-2 text-neutral-400">{t('games.disabled')}</p>}
    </div>
  </div>;
}
function GameRows({ games, opening, onOpen }: { games: SourceGame[]; opening: boolean; onOpen: (game: SourceGame) => void }) {
  const { t } = useLanguage();
  return <div className="space-y-2">{games.map(game => <article key={game.id} className="min-w-0 rounded-xl border border-white/10 p-3"><p className="break-words font-semibold text-neutral-200">{game.white.name}{game.white.rating ? ` (${game.white.rating})` : ''} — {game.black.name}{game.black.rating ? ` (${game.black.rating})` : ''}</p><p className="mt-1 text-neutral-400">{game.year ?? game.date?.slice(0,10)} · {game.result}</p><button type="button" disabled={opening} onClick={() => onOpen(game)} className="mt-2 min-h-10 rounded-lg bg-amber-200/10 px-4 font-semibold text-amber-100 disabled:opacity-50">{t('games.open')}</button></article>)}</div>;
}
