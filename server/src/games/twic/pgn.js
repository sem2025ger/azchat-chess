'use strict';
const { createHash } = require('node:crypto');
const { Chess } = require('chess.js');
function normalizeName(value) {
  return value.toLowerCase().replaceAll('ß','ss').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function positionHash(fen) {
  return createHash('sha256').update(fen.trim().split(/\s+/).slice(0,4).join(' ')).digest().readBigInt64BE(0).toString();
}
function splitPgn(text) {
  // Event is the first tag in standard PGN. Do not split inside a multiline comment.
  const games=[]; let current=[], braces=0;
  for (const line of text.replace(/^\uFEFF/,'').split(/\r?\n/)) {
    if (braces===0 && /^\s*\[Event\s+"/.test(line) && current.some(x=>x.trim())) { games.push(current.join('\n')); current=[]; }
    current.push(line);
    let quoted=false, escaped=false;
    for(const char of line){
      if(escaped){escaped=false;continue;}
      if(char==='\\' && quoted){escaped=true;continue;}
      if(char==='"' && braces===0){quoted=!quoted;continue;}
      if(!quoted){if(char===';'&&braces===0)break;if(char==='{')braces++;if(char==='}')braces=Math.max(0,braces-1);}
    }
  }
  if(current.some(x=>x.trim()))games.push(current.join('\n'));
  return games;
}
function parseGame(pgn, issue) {
  if(pgn.length>250000)throw new Error('PGN_TOO_LARGE');
  const game=new Chess();game.loadPgn(pgn);
  const headers=game.getHeaders(), history=game.history({verbose:true});
  if(!headers.White || !headers.Black || !history.length)throw new Error('INVALID_GAME');
  const result=['1-0','0-1','1/2-1/2','*'].includes(headers.Result)?headers.Result:'*';
  const canonicalHeaders=['Event','Site','Date','Round','White','Black','Result','FEN'].map(key=>[key,(headers[key]||'').trim().replace(/\s+/g,' ')]);
  const game_hash=createHash('sha256').update(JSON.stringify([canonicalHeaders,history.map(m=>m.san)])).digest('hex');
  const elo = value => /^\d+$/.test(value||'') && +value<=32767 ? +value : null;
  const year=/^\d{4}/.test(headers.Date||'')?+headers.Date.slice(0,4):null;
  return {source:'twic',source_issue:issue,game_hash,event:headers.Event||null,site:headers.Site||null,round:headers.Round||null,game_date:headers.Date||null,game_year:year,white:headers.White,black:headers.Black,white_norm:normalizeName(headers.White),black_norm:normalizeName(headers.Black),white_elo:elo(headers.WhiteElo),black_elo:elo(headers.BlackElo),result,eco:headers.ECO||null,ply_count:history.length,pgn:game.pgn(),positions:history.slice(0,24).map((m,i)=>({pos_hash:positionHash(m.after),ply:i+1}))};
}
module.exports={normalizeName,positionHash,splitPgn,parseGame};
