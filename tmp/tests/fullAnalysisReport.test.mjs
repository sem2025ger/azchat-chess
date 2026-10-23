import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess, DEFAULT_POSITION } from 'chess.js';
import { formatFullAnalysisReport } from '../src/utils/fullAnalysisReport.ts';

test('full analysis includes actual PGN, FEN, recorded depth and SAN/UCI variations', () => {
  const game = new Chess(DEFAULT_POSITION);
  game.move('e4');
  const fen = game.fen();
  const report = formatFullAnalysisReport({
    initialFen: DEFAULT_POSITION, moves: ['e4'], currentFen: fen,
    evaluations: {[fen]: {evaluation:0.42, depth:16}},
    currentResult: {evaluation:0.51, depth:18, analyzedFen:fen, bestMove:'e7e5', lines:[
      {multipv:1,evaluation:0.51,depth:18,pv:['e7e5','g1f3']}
    ]},
  });
  assert.match(report, /Initial FEN:/);
  assert.match(report, /Selected FEN:/);
  assert.match(report, /\[%eval 0\.42\].*\[%depth 16\]/s);
  assert.match(report, /Line 1 \| \+0\.51 \| depth 18/);
  assert.match(report, /SAN: e5 Nf3/);
  assert.match(report, /UCI: e7e5 g1f3/);
});

test('never exports old Stockfish lines for another FEN or a malformed PV', () => {
  const actual = formatFullAnalysisReport({
    initialFen: DEFAULT_POSITION,moves:[],currentFen:DEFAULT_POSITION,evaluations:{},
    currentResult:{evaluation:7,bestMove:'a2a3',depth:22,analyzedFen:'different',lines:[]},
  });
  assert.match(actual, /no completed evaluation for this position/);
  assert.doesNotMatch(actual, /Score: \+7/);
  const invalid = formatFullAnalysisReport({
    initialFen: DEFAULT_POSITION,moves:[],currentFen:DEFAULT_POSITION,evaluations:{},
    currentResult:{evaluation:0,bestMove:'',depth:10,analyzedFen:DEFAULT_POSITION,lines:[
      {multipv:1,evaluation:0,depth:10,pv:['e2e4','e2e5']}
    ]},
  });
  assert.match(invalid, /no valid engine continuation available/);
  assert.doesNotMatch(invalid, /SAN: e4/);
});
