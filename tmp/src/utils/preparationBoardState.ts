import {Chess,DEFAULT_POSITION,type Square,type PieceSymbol} from 'chess.js';
import {preparationMoves} from './preparationPositions.ts';
export type BoardStep={fen:string;san:string};
export type PreparationBoardState={steps:BoardStep[];cursor:number;text:string;source:'board'|'text';mode:'moves'|'setup';draft:string;flipped?:boolean};
export function initialBoardState(fen=DEFAULT_POSITION):PreparationBoardState{return {steps:[{fen,san:''}],cursor:0,text:'',source:'board',mode:'moves',draft:fen};}
export function boardAt(s:PreparationBoardState){return s.steps[s.cursor].fen;}
export function boardMove(s:PreparationBoardState,from:Square,to:Square,promotion:PieceSymbol){const game=new Chess(boardAt(s)),move=game.move({from,to,promotion});const steps=[...s.steps.slice(0,s.cursor+1),{fen:game.fen(),san:move.san}];return {...s,steps,cursor:steps.length-1,text:steps.slice(1).map(m=>m.san).join(' '),source:'board' as const};}
export function boardSeek(s:PreparationBoardState,delta:number){const cursor=Math.max(0,Math.min(s.steps.length-1,s.cursor+delta));return {...s,cursor,text:s.steps.slice(1,cursor+1).map(m=>m.san).join(' '),source:'board' as const};}
export function boardText(s:PreparationBoardState){if(!s.text.trim())throw Error('empty_moves');if(s.source==='board')return s;const parsed=preparationMoves(s.text),game=new Chess(),steps=[{fen:DEFAULT_POSITION,san:''}];for(const san of parsed.moves){game.move(san);steps.push({fen:game.fen(),san});}return {...s,steps,cursor:steps.length-1,text:parsed.moves.join(' '),source:'text' as const};}
