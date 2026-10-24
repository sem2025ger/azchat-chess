'use strict';
const { Chess, validateFen } = require('chess.js');
const { GamesError } = require('./errors');
function fen(input) {
  if (typeof input !== 'string' || input.length > 200 || !validateFen(input.trim()).ok) throw new GamesError('INVALID_FEN');
  return new Chess(input.trim()).fen({ forceEnpassantSquare: true }).split(' ').slice(0, 4).join(' ');
}
function username(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]{2,30}$/.test(input)) throw new GamesError('INVALID_USERNAME');
  return input.toLowerCase();
}
function integer(input, fallback, max, min = 1) {
  if (input === undefined) return fallback;
  if (typeof input !== 'string' || !/^\d+$/.test(input) || !Number.isSafeInteger(Number(input)) || Number(input) < min || Number(input) > max) throw new GamesError('INVALID_QUERY');
  return Number(input);
}
function gameId(input) {
  // Official examples use eight alphanumeric characters. No full URLs accepted.
  if (typeof input !== 'string' || !/^[A-Za-z0-9]{8}$/.test(input)) throw new GamesError('INVALID_QUERY');
  return input;
}
module.exports = { fen, username, integer, gameId };
