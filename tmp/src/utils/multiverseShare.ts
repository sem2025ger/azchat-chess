import { Chess } from 'chess.js';
import { validateAnalysisFen } from './analysisWorkspace.ts';
import { type MultiverseBranch, appendMultiverseMove, createMultiverseBranch } from './multiverse.ts';

/** Versioned, self-contained URL payload: `?mv=<base64url JSON>` on the Analysis route. */
export const MULTIVERSE_SHARE_PARAM = 'mv';
export const MULTIVERSE_SHARE_VERSION = 1;
export const MULTIVERSE_SHARE_MAX_LENGTH = 6000; // characters of the encoded payload
export const MULTIVERSE_SHARE_MAX_MOVES = 300;

interface SharePayload { v: number; fen: string; moves: string[]; label: string }

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('Invalid share payload');
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (encoded.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function encodeMultiverseShare(branch: MultiverseBranch): string {
  if (branch.moves.length > MULTIVERSE_SHARE_MAX_MOVES) throw new Error('Variation too long to share');
  const payload: SharePayload = { v: MULTIVERSE_SHARE_VERSION, fen: validateAnalysisFen(branch.rootFen), moves: branch.moves, label: branch.label.slice(0, 120) };
  const encoded = toBase64Url(JSON.stringify(payload));
  if (encoded.length > MULTIVERSE_SHARE_MAX_LENGTH) throw new Error('Variation too long to share');
  return encoded;
}

/** Rebuilds the branch by replaying every SAN move with chess.js; any invalid data throws. */
export function decodeMultiverseShare(encoded: string, id: string): MultiverseBranch {
  if (typeof encoded !== 'string' || !encoded || encoded.length > MULTIVERSE_SHARE_MAX_LENGTH) throw new Error('Invalid share payload');
  const parsed: unknown = JSON.parse(fromBase64Url(encoded));
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid share payload');
  const data = parsed as Partial<SharePayload>;
  if (data.v !== MULTIVERSE_SHARE_VERSION || typeof data.fen !== 'string' || !Array.isArray(data.moves) || data.moves.length > MULTIVERSE_SHARE_MAX_MOVES) {
    throw new Error('Unsupported share payload');
  }
  const label = typeof data.label === 'string' && data.label.trim() ? data.label.trim().slice(0, 120) : 'Shared variation';
  let branch = createMultiverseBranch(data.fen, label, id);
  for (const san of data.moves) {
    if (typeof san !== 'string' || san.length > 10) throw new Error('Invalid shared move');
    const game = new Chess(branch.positions[branch.positions.length - 1]);
    const move = game.move(san);
    if (!move) throw new Error('Illegal shared move');
    branch = appendMultiverseMove(branch, `${move.from}${move.to}${move.promotion ?? ''}`);
  }
  return branch;
}

export function multiverseShareUrl(origin: string, pathname: string, branch: MultiverseBranch): string {
  const url = new URL(pathname, origin);
  url.searchParams.set(MULTIVERSE_SHARE_PARAM, encodeMultiverseShare(branch));
  return url.toString();
}
