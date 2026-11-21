import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {Chess} from 'chess.js';
import {serverEngineLines} from '../src/utils/engineLines.ts';
import {chessyCopy} from '../src/i18n/chessyCopy.ts';
const source=readFileSync(new URL('../src/components/spieler/CoachChat.tsx',import.meta.url),'utf8');
const helper=source.slice(source.indexOf('type Continuation='),source.indexOf('type Reply='));
const {verifiedContinuations}=new Function('Chess','serverEngineLines',ts.transpile(helper,{target:ts.ScriptTarget.ES2022})+';return {verifiedContinuations};')(Chess,serverEngineLines);
const fen='r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const moves='Nc3 Nf6 d3 h6 Bb3 a5 Nxe5 Nxe5 d4 Bd6'.split(' ');
const line={moves,scoreKind:'cp',scoreWhite:10,continuation:{moves:['dxe5','Bxe5'],evalWhite:-0.1,depth:16,settled:true}};
test('FEN-bound continuation is separate, legal, and retained for replay',()=>{
 const [valid]=verifiedContinuations([line],fen);
 assert.deepEqual(valid.moves,moves);assert.deepEqual(valid.continuation,line.continuation);
 const board=new Chess(fen);for(const san of [...valid.moves,...valid.continuation.moves])board.move(san,{strict:true});
 assert.equal(board.get('e5').type,'b');
 for(const continuation of [null,{...line.continuation,moves:['e5']},{...line.continuation,moves:['dxe5','dxe5']},{...line.continuation,moves:[]},{...line.continuation,moves:Array(7).fill('dxe5')},{...line.continuation,depth:0},{...line.continuation,evalWhite:NaN},{...line.continuation,settled:'true'}])assert.equal(verifiedContinuations([{...line,continuation}],fen),null);
 assert.equal(verifiedContinuations([line],new Chess().fen()),null);
});
test('continuation boundary labels exist in all six languages',()=>{
 const expected={ru:'продолжение Stockfish',de:'Fortsetzung von Stockfish',en:'Stockfish continuation',az:'Stockfish davamı',tr:'Stockfish devamı',uk:'продовження Stockfish'};
 for(const [lang,label]of Object.entries(expected))assert.equal(chessyCopy[lang].stockfishContinuation,label);
});

test('each selected variation uses its own lesson, never the primary outcome',()=>{
 const fn=source.slice(source.indexOf('function lessonForLine('),source.indexOf('type Clip='));
 const lessonForLine=new Function(ts.transpile(fn,{target:ts.ScriptTarget.ES2022})+';return lessonForLine;')();
 const primary={lineIndex:0,intro:'Main objective',conclusion:'Main endpoint'};
 const other={lineIndex:1,intro:'Fork and recapture',conclusion:'Queen developed; material equal'};
 const item={planDemo:primary,lineLessons:[primary,other],candidateLines:[{}, {}, {unsettled:true}]};
 assert.deepEqual(lessonForLine(item,0),primary);
 assert.deepEqual(lessonForLine(item,1),other);
 assert.equal(lessonForLine(item,2),undefined);
 assert.equal(lessonForLine({planDemo:primary},1),undefined,'legacy chat must not reuse a main-line conclusion for an alternative');
 for(const copy of Object.values(chessyCopy)){assert.ok(copy.unsettledLine.length>10);assert.ok(copy.noLineLesson.length>10);}
});

test('the chat request waits longer than the server deadline so a lesson fallback can arrive',()=>{
 assert.match(source,/const CHAT_TIMEOUT_MS=60000;/);
 const at=source.indexOf('const payload={message,fen,side'),chatCall=source.slice(at,at+1200);
 assert.ok(at>0);
 assert.match(chatCall,/AbortSignal\.timeout\(CHAT_TIMEOUT_MS\)/);
 assert.doesNotMatch(chatCall,/AbortSignal\.timeout\(30000\)/);
});
