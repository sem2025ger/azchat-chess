'use strict';
// Adapter for the locked chess.js 1.4 engine. Keep legality checks while avoiding
// public move()'s verbose Move, full-board SAN enumeration and repetition cache.
const engineVersion=require('chess.js/package.json').version;
function assertReplayEngine(game){if(engineVersion!=='1.4.0'||!Array.isArray(game._board)||typeof game._makeMove!=='function'||typeof game._moves!=='function')throw Error('unsupported_replay_engine');}
const square=i=>'abcdefgh'[i&15]+(8-(i>>4));
function replayMove(game,token){
 const clean=token.replace(/[+#]$/,'').replace(/^0-0-0$/,'O-O-O').replace(/^0-0$/,'O-O');
 const castle=clean==='O-O'?32:clean==='O-O-O'?64:0;
 const parsed=castle?null:clean.match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/);
 if(!castle&&!parsed)throw Error('invalid_archive_move');
 const piece=castle?'k':(parsed[1]||'P').toLowerCase(),us=game._turn;
 const candidates=game._moves({legal:false,piece}).filter(m=>castle?(m.flags&castle):square(m.to)===parsed[5]&&(m.promotion||'')===(parsed[6]||'').toLowerCase());
 const legal=[],single=candidates.length===1;
 for(const move of candidates){game._makeMove(move);const safe=!game._isKingAttacked(us);if(!single||!safe)game._undoMove();if(safe)legal.push(move);}
 const selected=legal.filter(m=>castle||((!parsed[2]||square(m.from)[0]===parsed[2])&&(!parsed[3]||square(m.from)[1]===parsed[3])&&!!(m.captured)===!!parsed[4]));
 if(selected.length!==1){if(single&&legal.length)game._undoMove();throw Error('invalid_archive_move');}
 const move=selected[0],from=square(move.from),to=square(move.to);
 let san=castle?clean:piece==='p'?(move.captured?from[0]:''):piece.toUpperCase();
 if(!castle&&piece!=='p'){
  const others=legal.filter(m=>m.from!==move.from);
  if(others.length){const file=others.some(m=>square(m.from)[0]===from[0]),rank=others.some(m=>square(m.from)[1]===from[1]);san+=file&&rank?from:file?from[1]:from[0];}
 }
 if(!castle)san+=(move.captured?'x':'')+to+(move.promotion?'='+move.promotion.toUpperCase():'');
 if(!single)game._makeMove(move);
 if(game._isKingAttacked(game._turn))san+=game._moves().length?'+':'#';
 return san;
}
function replayKey(game){
 let placement='';
 for(let rank=0;rank<8;rank++){let empty=0;if(rank)placement+='/';for(let file=0;file<8;file++){const piece=game._board[rank*16+file];if(!piece){empty++;continue;}if(empty){placement+=empty;empty=0;}placement+=piece.color==='w'?piece.type.toUpperCase():piece.type;}if(empty)placement+=empty;}
 const rights=(game._castling.w&32?'K':'')+(game._castling.w&64?'Q':'')+(game._castling.b&32?'k':'')+(game._castling.b&64?'q':'')||'-';
 let ep='-';
 if(game._epSquare!==-1){const target=game._epSquare,us=game._turn,behind=target+(us==='w'?16:-16);for(const from of [behind-1,behind+1]){if(from&0x88||game._board[from]?.type!=='p'||game._board[from]?.color!==us)continue;game._makeMove({color:us,from,to:target,piece:'p',captured:'p',flags:8});const safe=!game._isKingAttacked(us);game._undoMove();if(safe){ep=square(target);break;}}}
 return placement+' '+game._turn+' '+rights+' '+ep;
}
module.exports={replayMove,replayKey,assertReplayEngine};
