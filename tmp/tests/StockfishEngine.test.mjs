import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { StockfishEngine } from '../src/utils/StockfishEngine.ts';

const originalWorker = globalThis.Worker;
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const nextFen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
let workers;
let engines;

// Replace only the browser transport: exercise the real production UCI parser and scheduler.
class WorkerStub {
  commands = [];
  terminated = false;
  constructor() { workers.push(this); }
  postMessage(command) { this.commands.push(command); }
  terminate() { this.terminated = true; }
  emit(line) { this.onmessage({ data: line }); }
}

beforeEach(t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  workers = [];
  engines = [];
  globalThis.Worker = WorkerStub;
});

afterEach(() => {
  for (const engine of engines) engine.destroy();
  if (originalWorker === undefined) delete globalThis.Worker;
  else globalThis.Worker = originalWorker;
});

function setup() {
  const engine = new StockfishEngine();
  engines.push(engine);
  const worker = workers.at(-1);
  const results = [];
  engine.onResult(result => results.push(result));
  worker.emit('uciok');
  worker.emit('readyok');
  engine.analyze(startFen);
  return { engine, worker, results };
}

function info(worker, depth = 8, multipv = 1, cp = 24) {
  const pv = ['e2e4 e7e5 g1f3', 'd2d4 d7d5 c2c4', 'g1f3 d7d5 d2d4'][multipv - 1];
  worker.emit(`info depth ${depth} multipv ${multipv} score cp ${cp} pv ${pv}`);
}

test('burst updates are coalesced while all three real engine lines stay available', t => {
  const { worker, results } = setup();
  assert.ok(worker.commands.includes('setoption name MultiPV value 3'));
  for (let depth = 5; depth <= 14; depth++) {
    for (let multipv = 1; multipv <= 3; multipv++) info(worker, depth, multipv, depth);
  }
  assert.equal(results.length, 0);
  t.mock.timers.tick(79);
  assert.equal(results.length, 0);
  t.mock.timers.tick(1);
  assert.equal(results.length, 1);
  assert.equal(results[0].depth, 14);
  assert.equal(results[0].evaluation, 0.14);
  assert.equal(results[0].lines.length, 3);
  assert.equal(results[0].lines[2].depth, 14);
  assert.equal(results[0].analyzedFen, startFen);
});

test('final bestmove arrives immediately and is never followed by a delayed duplicate', t => {
  const { worker, results } = setup();
  info(worker);
  worker.emit('bestmove e2e4 ponder e7e5');
  assert.equal(results.length, 1);
  assert.equal(results[0].bestMove, 'e2e4');
  t.mock.timers.tick(200);
  assert.equal(results.length, 1);
});

test('changing positions cancels pending UI results from the previous search', t => {
  const { engine, worker, results } = setup();
  info(worker);
  engine.analyze(nextFen);
  t.mock.timers.tick(100);
  assert.equal(results.length, 0);
  worker.emit('bestmove e2e4');
  assert.ok(worker.commands.includes(`position fen ${nextFen}`));
  worker.emit('info depth 8 multipv 1 score cp 31 pv e7e5 g1f3 b8c6');
  t.mock.timers.tick(80);
  assert.equal(results.length, 1);
  assert.equal(results[0].analyzedFen, nextFen);
  assert.equal(results[0].bestMove, 'e7e5');
  assert.equal(results[0].evaluation, -0.31);
});

test('stop discards a scheduled update and late bestmove', t => {
  const { engine, worker, results } = setup();
  info(worker);
  engine.stop();
  worker.emit('bestmove e2e4');
  t.mock.timers.tick(100);
  assert.equal(results.length, 0);
});

test('stop followed immediately by analyze waits for the old bestmove acknowledgement', t => {
  const { engine, worker, results } = setup();
  info(worker);
  engine.stop();
  engine.analyze(nextFen);
  worker.emit('bestmove e2e4');
  assert.equal(results.length, 0, 'old bestmove must not be labelled as the new position');
  worker.emit('info depth 9 multipv 1 score cp 12 pv e7e5 g1f3');
  t.mock.timers.tick(80);
  assert.equal(results.length, 1);
  assert.equal(results[0].bestMove, 'e7e5');
  assert.equal(results[0].analyzedFen, nextFen);
});

test('destroy cancels callbacks and terminates its worker', t => {
  const { engine, worker, results } = setup();
  info(worker);
  engine.destroy();
  t.mock.timers.tick(20000);
  assert.equal(results.length, 0);
  assert.equal(worker.terminated, true);
});

test('worker failure clears a pending intermediate result', t => {
  const { engine, worker, results } = setup();
  let failures = 0;
  engine.onError(() => failures++);
  info(worker);
  worker.onerror(new Error('test worker failure'));
  t.mock.timers.tick(100);
  assert.equal(results.length, 0);
  assert.equal(failures, 1);
  assert.equal(engine.hasFailed(), true);
});

test('mate score and continuation survive coalescing', t => {
  const { worker, results } = setup();
  worker.emit('info depth 8 multipv 1 score mate 2 pv e2e4 e7e5');
  t.mock.timers.tick(80);
  assert.equal(results[0].mate, 2);
  assert.deepEqual(results[0].continuation, ['e7e5']);
});
