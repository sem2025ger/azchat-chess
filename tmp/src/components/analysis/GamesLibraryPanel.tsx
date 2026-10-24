import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { gamesRequest, GamesApiError, type GamesStatus, type MastersResult, type SourceGame, type UserGamesResult, type DbGamesResult } from '../../services/gamesDatabase';
import { analysisFromPgn, type AnalysisLoad } from '../../utils/analysisWorkspace';
import SavedGamesPanel from './SavedGamesPanel';
import type { AnalysisWords } from './copy';

export default function GamesLibraryPanel({ userId, language, words, fen, onLoad, desktopOnly = false }: {
  userId?: string; language: string; words: AnalysisWords; fen: string; desktopOnly?: boolean;
  onLoad: (analysis: AnalysisLoad, title: string, details?: { white: string; black: string }) => void;
}) {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(false);
  const [visible, setVisible] = useState(() => !desktopOnly || window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    if (!desktopOnly) return;
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setVisible(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [desktopOnly]);
  if (!visible) return null;
  return <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={t('games.tab')}>
    <div className="flex shrink-0 gap-2 border-b border-white/10 p-2">
      {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={saved === value} onClick={() => setSaved(value)} className={`min-h-10 min-w-0 flex-1 rounded-lg px-2 text-xs font-semibold ${saved === value ? 'bg-white/10 text-amber-100' : 'text-neutral-400'}`}>{t(value ? 'games.saved' : 'games.sources')}</button>)}
    </div>
    {saved ? <SavedGamesPanel userId={userId} language={language} words={words} onLoad={onLoad} /> : <SourceGamesPanel fen={fen} onLoad={onLoad} />}
  </section>;
}

function SourceGamesPanel({ fen, onLoad }: { fen: string; onLoad: (analysis: AnalysisLoad, title: string, details: { white: string; black: string }) => void }) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'position' | 'player' | 'db'>('position');
  const [dbPlayer, setDbPlayer] = useState('');
  const [onlyPosition, setOnlyPosition] = useState(false);
  const [dbData, setDbData] = useState<DbGamesResult | null>(null);
  const dbSearch = useRef('');
  const [username, setUsername] = useState('');
  const [playerData, setPlayerData] = useState<UserGamesResult | null>(null);
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
    gamesRequest<GamesStatus>('/status', controller.signal).then(next => {
      if (!controller.signal.aborted) { setStatus(next); if (!next.lichess && next.db) { setMode('db'); setLoading(false); } }
    }).catch(reason => { if (!controller.signal.aborted) { setLoading(false); setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); } });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (mode !== 'position' || !status) return;
    const controller = new AbortController();
    setLoading(true); setError(null); setData(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          if (!status.lichess) throw new GamesApiError('FEATURE_DISABLED');
          const result = await gamesRequest<MastersResult>('/masters?' + new URLSearchParams({ fen: normalizedFen + ' 0 1' }), controller.signal);
          if (!controller.signal.aborted) setData(result);
        } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
        finally { if (!controller.signal.aborted) setLoading(false); }
      })();
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [normalizedFen, mode, status]);
  const searchPlayer = async () => {
    if (!/^[A-Za-z0-9_-]{2,30}$/.test(username)) { setError(new GamesApiError('INVALID_USERNAME')); return; }
    const controller = new AbortController(); openRequest.current?.abort(); openRequest.current = controller;
    setLoading(true); setError(null); setPlayerData(null);
    try {
      const result = await gamesRequest<UserGamesResult>('/lichess-user/' + encodeURIComponent(username) + '?max=30', controller.signal);
      if (!controller.signal.aborted) setPlayerData(result);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const searchDb = async (more = false) => {
    if (!more && dbPlayer.trim().length < 3 && !onlyPosition) { setError(new GamesApiError('INVALID_QUERY')); return; }
    const controller = new AbortController(); openRequest.current?.abort(); openRequest.current = controller;
    const params = more ? new URLSearchParams(dbSearch.current) : new URLSearchParams({ ...(dbPlayer.trim() ? { player: dbPlayer.trim() } : {}), ...(onlyPosition ? { fen } : {}), limit: '20' });
    if (!more) dbSearch.current = params.toString();
    params.set('offset', String(more ? dbData?.games.length || 0 : 0));
    setLoading(true); setError(null); if (!more) setDbData(null);
    try {
      const result = await gamesRequest<DbGamesResult>('/db/search?' + params, controller.signal);
      if (!controller.signal.aborted) setDbData(previous => more && previous ? { ...result, games: [...previous.games, ...result.games] } : result);
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const open = async (game: SourceGame) => {
    if (opening) return;
    const controller = new AbortController(); openRequest.current = controller;
    setOpening(true); setError(null);
    try {
      const result = game.pgn ? { pgn: game.pgn } : await gamesRequest<{ pgn: string }>(`/${mode === 'db' ? 'db' : 'masters'}/${game.id}/pgn`, controller.signal);
      const analysis = analysisFromPgn(result.pgn);
      if (!controller.signal.aborted) onLoad(analysis, `${game.white.name} — ${game.black.name}`, { white: game.white.name, black: game.black.name });
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof GamesApiError ? reason : new GamesApiError('UPSTREAM_UNAVAILABLE')); }
    finally { if (!controller.signal.aborted) setOpening(false); }
  };
  return <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <div className="shrink-0 space-y-3 p-3">
      <div role="group" aria-label={t('games.sources')} className="flex gap-2">{(['position','player','db'] as const).filter(value => value === 'db' ? status?.db : status?.lichess !== false).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => { openRequest.current?.abort(); setMode(value); setLoading(value === 'position'); setError(null); setOpening(false); }} className={`min-h-10 min-w-0 flex-1 rounded-lg border px-2 text-xs ${mode === value ? 'border-amber-100/30 bg-amber-100/10 text-amber-100' : 'border-white/10 text-neutral-400'}`}>{t(`games.${value}`)}</button>)}</div>
      {mode === 'db' && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void searchDb(); }}><input aria-label={t('games.playerName')} placeholder={t('games.playerName')} value={dbPlayer} maxLength={100} onChange={event => setDbPlayer(event.target.value)} className="min-h-10 w-full min-w-0 rounded-lg border border-white/15 bg-black/30 px-2 text-sm" /><label className="flex items-center gap-2 text-xs text-neutral-300"><input type="checkbox" checked={onlyPosition} onChange={event => setOnlyPosition(event.target.checked)} />{t('games.onlyPosition')}</label><p className="text-xs text-neutral-500">{t('games.dbInfo')}</p><button type="submit" disabled={loading || opening} className="min-h-10 rounded-lg bg-amber-200/15 px-4 text-xs text-amber-100 disabled:opacity-50">{t('games.search')}</button></form>}
      {mode === 'player' && <form className="flex min-w-0 gap-2" onSubmit={event => { event.preventDefault(); void searchPlayer(); }}><input value={username} onChange={event => setUsername(event.target.value)} maxLength={30} aria-label={t('games.username')} placeholder={t('games.username')} className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-2 text-sm" /><button type="submit" disabled={loading || opening} className="min-h-10 rounded-lg bg-amber-200/15 px-3 text-xs text-amber-100 disabled:opacity-50">{t('games.search')}</button></form>}
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 text-xs" aria-busy={loading || opening}>
      {loading && <div role="status" className="animate-pulse space-y-3"><p>{t('games.loading')}</p>{[0,1,2].map(i => <div key={i} className="h-10 rounded-lg bg-white/5" />)}</div>}
      {error && <div role="alert" className="mb-3 rounded-lg border border-red-300/25 p-3 text-red-200"><p>{t(`games.error.${error.code}`)}{error.retryAfter > 0 && ` · ${error.retryAfter} ${t('games.seconds')}`}</p><button type="button" className="mt-2 min-h-9 underline" onClick={() => mode === 'db' ? void searchDb() : mode === 'player' ? void searchPlayer() : setRetry(x => x + 1)}>{t('games.retry')}</button></div>}
      {mode === 'position' && !loading && !error && data && <>
        {!data.moves.length && !data.topGames.length && <p className="py-5 text-neutral-400">{t('games.emptyPosition')}</p>}
        <div className="space-y-2">{data.moves.map(move => <div key={move.uci} className="rounded-lg border border-white/10 p-2"><div className="mb-1 flex justify-between"><strong>{move.san}</strong><span>{move.games.toLocaleString()} {t('games.count')}</span></div><div className="flex h-2 overflow-hidden rounded" aria-label={`${t('game.white')} ${move.white}, ${t('games.draws')} ${move.draws}, ${t('game.black')} ${move.black}`}><span className="bg-neutral-100" style={{width:`${move.games ? move.white / move.games * 100 : 0}%`}} /><span className="bg-neutral-500" style={{width:`${move.games ? move.draws / move.games * 100 : 0}%`}} /><span className="bg-neutral-800" style={{width:`${move.games ? move.black / move.games * 100 : 0}%`}} /></div><p className="mt-1 text-[11px] text-neutral-400">{t('game.white')} {move.games ? Math.round(move.white / move.games * 100) : 0}% · {t('games.draws')} {move.games ? Math.round(move.draws / move.games * 100) : 0}% · {t('game.black')} {move.games ? Math.round(move.black / move.games * 100) : 0}%</p></div>)}</div>
        <h3 className="mb-2 mt-5 font-bold text-amber-100">{t('games.top')}</h3>
        <GameRows games={data.topGames} opening={opening} onOpen={open} />
        <h3 className="mb-2 mt-4 font-bold text-amber-100">{t('games.recent')}</h3><p className="text-neutral-400">{t('games.noRecentMasters')}</p>
      </>}
      {mode === 'player' && !loading && !error && playerData && <>
        {(['white','black'] as const).map(color => <section key={color} className="mb-4"><h3 className="mb-2 font-semibold text-amber-100">{t(`game.${color}`)} · {t('games.openings')}</h3>{playerData.openings[color].length ? playerData.openings[color].map(item => <p key={item.eco + item.name} className="mb-1 break-words text-neutral-300">{item.eco} {item.name} · {item.games} {t('games.count')} · {item.scorePct}%</p>) : <p className="text-neutral-400">{t('games.noOpenings')}</p>}</section>)}
        <p className="mb-3 text-neutral-500">{t('games.sample')}</p>
        {!playerData.games.length && <p className="py-5 text-neutral-400">{t('games.emptyPlayer')}</p>}
        <GameRows games={playerData.games} opening={opening} onOpen={open} />
      </>}
      {mode === 'db' && !loading && !error && dbData && <>
        {!dbData.games.length && <p className="py-5 text-neutral-400">{t('games.emptyDb')}</p>}
        <GameRows games={dbData.games} opening={opening} onOpen={open} />
        {dbData.games.length < dbData.total && <button type="button" className="mt-3 min-h-10 w-full rounded-lg border border-white/15 text-amber-100" disabled={opening} onClick={() => void searchDb(true)}>{t('games.more')}</button>}
      </>}
      <p className="mt-5 border-t border-white/10 pt-3 text-neutral-400"><a href={mode === 'db' ? 'https://theweekinchess.com' : 'https://lichess.org'} target="_blank" rel="noopener noreferrer">{t(mode === 'db' ? 'games.attributionTwic' : mode === 'position' ? 'games.attributionMasters' : 'games.attributionLichess')}</a></p>
      {status && !status.lichess && <p className="mt-2 text-neutral-400">{t('games.disabled')}</p>}
    </div>
  </div>;
}
function GameRows({ games, opening, onOpen }: { games: SourceGame[]; opening: boolean; onOpen: (game: SourceGame) => void }) {
  const { t } = useLanguage();
  return <div className="space-y-2">{games.map(game => <article key={game.id} className="min-w-0 rounded-xl border border-white/10 p-3"><p className="break-words font-semibold text-neutral-200">{game.white.name}{game.white.rating ? ` (${game.white.rating})` : ''} — {game.black.name}{game.black.rating ? ` (${game.black.rating})` : ''}</p><p className="mt-1 text-neutral-400">{game.year ?? game.date?.slice(0,10)} · {game.result}</p><button type="button" disabled={opening} onClick={() => onOpen(game)} className="mt-2 min-h-10 rounded-lg bg-amber-200/10 px-4 font-semibold text-amber-100 disabled:opacity-50">{t('games.open')}</button>{game.url && <a href={game.url} target="_blank" rel="noopener noreferrer" className="ml-3 underline text-neutral-400">lichess.org</a>}</article>)}</div>;
}
