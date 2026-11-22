import { lazy, Suspense } from 'react';
import type { StaffOnlineBoard } from '../../services/teamTournaments';
import type { TournamentCopy } from './copy';
import { staffOnlineBoardState, stateLabels } from './onlineBoardState';

const Cards = lazy(() => import('./TournamentOnlinePlay').then(module => ({ default: module.TournamentOnlineCards })));
const Banner = lazy(() => import('./TournamentOnlinePlay').then(module => ({ default: module.TournamentOnlineBanner })));

export function TournamentOnlineCards({ event }: { event?: string }) {
  return <Suspense fallback={null}><Cards event={event} /></Suspense>;
}

export function TournamentOnlineBanner() {
  return <Suspense fallback={null}><Banner /></Suspense>;
}

export function OrganizerOnlineBoard({ board, tr }: { board: StaffOnlineBoard; tr: TournamentCopy }) {
  const state = staffOnlineBoardState(board);
  return <p data-organizer-online-board={state}>{tr(stateLabels[state])}</p>;
}
