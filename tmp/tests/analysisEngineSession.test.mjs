import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acquireAnalysisEngine, releaseAnalysisEngine, primeAnalysisEngine } from '../src/utils/analysisEngineSession.ts';

const originals={worker:globalThis.Worker,window:globalThis.window,document:globalThis.document,navigator:globalThis.navigator};
let made=[];
class WorkerStub {
  commands=[];
  terminated=false;
  constructor(url) { this.url=url; made.push(this); }
  postMessage(command) { this.commands.push(command); }
  terminate() { this.terminated=true; }
  emit(line) { this.onmessage?.({data:line}); }
}
beforeEach(t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  made=[];
  globalThis.Worker=WorkerStub;
  globalThis.window={matchMedia:()=>({matches:true})};
  globalThis.document={hidden:false};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{connection:{saveData:false}}});
});
afterEach(()=>{
  for(const key of ['worker','window','document']) {
    const target=key==='worker'?'Worker':key;
    if(originals[key]===undefined) delete globalThis[target];
    else globalThis[target]=originals[key];
  }
  if(originals.navigator===undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis,'navigator',{configurable:true,value:originals.navigator});
});

test('navigation primes exactly one idle UCI Worker and reuses it for analysis',t=>{
  primeAnalysisEngine();
  primeAnalysisEngine();
  assert.equal(made.length,1);
  assert.deepEqual(made[0].commands,['uci'],'no search starts in homepage');
  made[0].emit('uciok');made[0].emit('readyok');
  const engine=acquireAnalysisEngine();
  assert.equal(made.length,1);
  assert.equal(engine.isReady(),true);
  engine.analyze('startpos');
  assert.ok(made[0].commands.some(c=>c.startsWith('go depth')));
  releaseAnalysisEngine(engine);
  assert.equal(made[0].commands.at(-1),'stop');
  const next=acquireAnalysisEngine();
  assert.equal(next,engine);
  releaseAnalysisEngine(next);
  t.mock.timers.tick(30_000);
  assert.equal(made[0].terminated,true);
});

test('idle-expired worker is not reused after 30 seconds',t=>{
  const e=acquireAnalysisEngine();
  releaseAnalysisEngine(e);
  t.mock.timers.tick(30_000);
  assert.equal(made[0].terminated,true);
  const fresh=acquireAnalysisEngine();
  assert.notEqual(fresh,e);
  releaseAnalysisEngine(fresh);
  t.mock.timers.tick(30_000);
});

test('save-data and mobile sessions skip speculative Worker startup',t=>{
  globalThis.window.matchMedia=()=>({matches:false});
  primeAnalysisEngine();
  assert.equal(made.length,0);
  globalThis.window.matchMedia=()=>({matches:true});
  globalThis.navigator.connection.saveData=true;
  primeAnalysisEngine();
  assert.equal(made.length,0);
  t.mock.timers.tick(30_000);
});

test('secondary Stockfish lines gain contrast without changing first move or evaluation badges',()=>{
  const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');
  assert.match(css,/\.desktop-analysis-screen \.analysis-engine-moves span\.text-neutral-400 \{ color:#c5c7c3; \}/);
  assert.match(css,/\.desktop-analysis-screen \.analysis-engine-score\[data-score-side=/);
});
