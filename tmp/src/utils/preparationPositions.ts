import {Chess,type Move} from 'chess.js';
import {validateAnalysisFen} from './analysisWorkspace.ts';
import type {PreparationGame,PreparationFilters} from '../../../shared/vorbereitung.mjs';
import {analysePreparation} from '../../../shared/vorbereitung.mjs';
export function preparationPositionKey(fen:string){return new Chess(validateAnalysisFen(fen)).fen().split(' ').slice(0,4).join(' ');}
export function preparationMoves(text:string){
 if(text.length>12000)throw Error('invalid_moves');const game=new Chess();
 const tokens=text.replace(/\{[^}]*\}/g,' ').replace(/\d+\.(?:\.\.)?/g,' ').trim().split(/\s+/).filter(Boolean);
 if(tokens.length>256)throw Error('too_many_moves');
 const letters:Record<string,string>={D:'Q',T:'R',L:'B',S:'N',K:'K'};
 for(let token of tokens){if(['1-0','0-1','1/2-1/2','*','e.p.'].includes(token))continue;
  token=token.replace(/^0-0-0/,'O-O-O').replace(/^0-0/,'O-O').replace(/[!?]+$/,'');
  token=token.replace(/^([DTLSK])(?=[a-h1-8x])/,m=>letters[m]).replace(/=([DTLS])/g,(_,p)=>'='+letters[p]);
  game.move(token);
 }return {fen:game.fen(),moves:game.history()};
}
export type PositionIndex={game:PreparationGame;moves:Move[];positions:Map<string,number>};
export function indexPreparationGames(games:PreparationGame[]){const index:PositionIndex[]=[];let rejected=0;
 for(const game of games){try{const chess=new Chess();chess.loadPgn(game.pgn);const moves=chess.history({verbose:true});if(!moves.length||moves.length>2048)throw Error();
  const positions=new Map<string,number>();const add=(fen:string,ply:number)=>{const key=new Chess(fen).fen().split(' ').slice(0,4).join(' ');if(!positions.has(key))positions.set(key,ply);};
  add(moves[0].before,0);moves.forEach((m,i)=>add(m.after,i+1));index.push({game,moves,positions});
 }catch{rejected++;}}return {index,rejected};
}
export function searchPreparationPosition(index:PositionIndex[],fen:string,filters:PreparationFilters={}){
 const key=preparationPositionKey(fen),turn=key.split(' ')[1];const allowed=new Set(analysePreparation(index.map(i=>i.game),filters).games.map(g=>g.id));
 const hits:{id:string;ply:number}[]=[],next=new Map<string,{san:string;uci:string;games:number}>();let playerToMove=0;
 for(const row of index){if(!allowed.has(row.game.id))continue;const ply=row.positions.get(key);if(ply===undefined)continue;hits.push({id:row.game.id,ply});
  const move=row.moves[ply];if(move&&turn===(row.game.color==='white'?'w':'b')){playerToMove++;const uci=move.from+move.to+(move.promotion||'');const group=next.get(uci)||{san:move.san,uci,games:0};group.games++;next.set(uci,group);}
 }
 return {hits,playerToMove,nextMoves:[...next.values()].map(m=>({...m,percent:playerToMove?Math.round(m.games*1000/playerToMove)/10:0})).sort((a,b)=>b.games-a.games||a.san.localeCompare(b.san))};
}
