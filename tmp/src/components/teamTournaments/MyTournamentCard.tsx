import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  createTournamentM3Api, type MyTournamentBoard, type BoardResult,
} from '../../services/teamTournaments';
import { tournamentCopy } from './copy';

type HomeState = { board: MyTournamentBoard | null; error: boolean; loadedVersion: number };

function outcome(side: 'white' | 'black', result: BoardResult | null) {
  if (!result) return null;
  if (result === '1/2-1/2') return 'draw' as const;
  const whiteWin = result === '1-0' || result === '+/-';
  const blackWin = result === '0-1' || result === '-/+';
  if (!whiteWin && !blackWin) return 'draw' as const;
  return (side === 'white' ? whiteWin : blackWin) ? 'win' as const : 'loss' as const;
}

function resultFor(side: 'white' | 'black', choice: 'win' | 'draw' | 'loss'): BoardResult {
  if (choice === 'draw') return '1/2-1/2';
  return ((choice === 'win') === (side === 'white')) ? '1-0' : '0-1';
}

export default function MyTournamentCard() {
  const { session } = useAuth();
  // Do not reuse one player's board when the signed-in account changes.
  return session?.access_token
    ? <PlayerTournamentCard key={session.user.id} token={session.access_token} />
    : null;
}

function PlayerTournamentCard({ token }: { token: string }) {
  const { language } = useLanguage();
  const tr = tournamentCopy(language);
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<HomeState>({ board: null, error: false, loadedVersion: -1 });
  const [pending, setPending] = useState(false);
  const board = state.board;
  const busy = pending || state.loadedVersion !== version;
  useEffect(() => {
    const controller = new AbortController();
    void createTournamentM3Api(import.meta.env.VITE_SERVER_URL, token)
      .myBoard(controller.signal).then(data => {
        if (!controller.signal.aborted) setState({ board: data.board, error: false, loadedVersion: version });
      }, () => {
        if (!controller.signal.aborted) setState({ board: null, error: true, loadedVersion: version });
      });
    return () => controller.abort();
  }, [token, version]);

  async function submit(action: 'report' | 'confirm', value: BoardResult | null) {
    if (!board || busy) return;
    const controller = new AbortController();
    setPending(true);
    try {
      await createTournamentM3Api(import.meta.env.VITE_SERVER_URL, token)
        .report(board, action, value, null, controller.signal);
      setVersion(v => v + 1);
    } catch {
      setState(prev => ({ ...prev, error: true }));
    } finally {
      setPending(false);
    }
  }

  // Do not reserve space on the Home page for visitors or players without
  // an active board. Preserve the approved Home composition with flags off.
  if (!board && !state.error) return null;
  const opponentResult = board?.opponent_report ?
    outcome(board.side, board.opponent_report) : null;
  const ownLabel = (choice: 'win' | 'draw' | 'loss') =>
    choice === 'win' ? tr('homeWin') : choice === 'draw' ? tr('homeDraw') : tr('homeLoss');
  return <section className="w-full rounded-xl border border-[#9A825F]/50 bg-[#171717]/95 p-3 mt-3 text-[#E8E4DA]"
    aria-label={tr('myTournament')}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold">{tr('myTournament')}</h2>
      <button type="button" className="underline text-xs" disabled={busy}
        onClick={() => setVersion(v => v + 1)}>{tr('refresh')}</button>
    </div>
    {state.error && <p role="alert" className="text-xs mt-1">{tr('reportError')}</p>}
    {board && <>
      <p className="text-xs mt-1">{board.tournament_name} · {tr('round')} {board.round_no} · {tr('board')} {board.board_no}</p>
      <p className="text-sm mt-1">{tr('opponent')} {board.opponent} · {tr('myColor')}: {board.side === 'white' ? tr('white') : tr('black')}</p>
      {board.status === 'confirmed' || board.confirmed ? <p role="status" className="text-xs mt-2">{tr('confirmedResult')}</p> :
        board.status === 'disputed' ? <p role="alert" className="text-xs mt-2">{tr('disputed')}</p> :
        <>
          {opponentResult && <div className="mt-2">
            <p className="text-xs">{tr('opponentReported')}: {ownLabel(opponentResult)}</p>
            <button type="button" disabled={busy}
              className="mt-2 min-h-11 rounded-lg border border-[#9A825F] px-4 text-sm"
              onClick={() => void submit('confirm', null)}>{tr('confirm')}</button>
          </div>}
          <p className="text-xs mt-2">{tr('reporting')}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {(['win', 'draw', 'loss'] as const).map(choice =>
              <button type="button" key={choice} disabled={busy}
                className="min-h-11 min-w-14 rounded-lg border border-[#9A825F] px-3 text-sm"
                aria-label={ownLabel(choice)}
                onClick={() => void submit('report', resultFor(board.side, choice))}>
                {choice === 'win' ? '1' : choice === 'draw' ? '½' : '0'}
              </button>)}
          </div>
        </>}
    </>}
  </section>;
}
