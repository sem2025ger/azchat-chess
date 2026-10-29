'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {GamesProvider,normalizeGame,readBounded,MAX_BYTES}=require('./spielerGamesProvider');
const {twicRows}=require('./scripts/importTwic');
const pgn='[Event "Fixture"]\n[White "White"]\n[Black "Black"]\n[WhiteFideId "13404431"]\n[ECO "C60"]\n[Opening "Ruy Lopez"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 *';
test('Lichess uses official fixed API, bounded PGN and unique games/opening counts',async()=>{
 const calls=[];const provider=new GamesProvider({fetchImpl:async(url,options)=>{calls.push({url,options});return new Response(pgn+'\n\n'+pgn);}});
 const r=await provider.games({source:'lichess',nickname:'Player_2',fideId:'13404431'});assert.equal(r.games.length,1);assert.equal(r.openings[0].count,1);assert.match(r.openings[0].name,/C60.*Ruy Lopez/);
 assert.match(calls[0].url,/^https:\/\/lichess.org\/api\/games\/user\/Player_2\?/);assert.equal(calls[0].options.redirect,'error');
 await assert.rejects(provider.games({source:'lichess',nickname:'../evil',fideId:'13404431'}));assert.equal(calls.length,1);
});
test('Chess.com archives cannot redirect fetches to supplied external hosts',async()=>{
 const calls=[];const base='https://api.chess.com/pub/player/player/games/';const provider=new GamesProvider({fetchImpl:async url=>{calls.push(url);return new Response(JSON.stringify(url.endsWith('archives')?{archives:['https://evil.test/x',base+'2026/09',base+'2026/10']}:{games:[{rules:'chess',pgn},{rules:'chess960',pgn}]}));}});
 const r=await provider.games({source:'chesscom',nickname:'PLAYER',fideId:'13404431'});assert.deepEqual(calls,[base+'archives',base+'2026/10']);assert.equal(r.games.length,1);
});
test('TWIC matches exact FIDE IDs; malformed PGN is excluded without inventing statistics',async()=>{
 const provider=new GamesProvider({twic:async()=>[{pgn},{pgn:'invalid'},{pgn:pgn.replace('13404431','999')}]});
 const r=await provider.games({source:'twic',fideId:'13404431'});assert.equal(r.games.length,1);assert.equal(r.rejected,2);
 assert.equal(twicRows(pgn,'twic1600')[0].white_fide_id,'13404431');assert.throws(()=>twicRows(pgn,'https://evil'));
 assert.throws(()=>normalizeGame(pgn.replace('[ECO','[Variant "Chess960"]\n[ECO'),'twic'));
 const noOpening=normalizeGame(pgn.replace('[Opening "Ruy Lopez"]',''),'twic');assert.match(noOpening.opening,/^Züge:/);
});
test('external response size limits apply with and without content length',async()=>{
 await assert.rejects(readBounded(new Response('x',{headers:{'content-length':String(MAX_BYTES+1)}})));
 await assert.rejects(readBounded(new Response('x'.repeat(MAX_BYTES+1))));
 await assert.rejects(readBounded(new Response('error',{status:429})));
});
