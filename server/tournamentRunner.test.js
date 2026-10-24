'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createTournamentRunner}=require('./tournamentRunner');
const fs=require('node:fs');
const sql=fs.readFileSync('../supabase/migrations/20261024050000_chessaz_deutsch_tournament_engine.sql','utf8');
const fake=()=>({from(){throw new Error('must not query disabled engine');}});
test('fail closed: no timer/database calls while tournament engine disabled',async()=>{
 const runner=createTournamentRunner({db:fake(),durableGames:{ready:()=>true},io:{},activeRooms:new Map(),socketToRoom:new Map(),enabled:false});
 await runner.tick();
});
test('fail closed: unavailable durable game store must not publish any tournament rounds',async()=>{
 const runner=createTournamentRunner({db:fake(),durableGames:{ready:()=>false},io:{},activeRooms:new Map(),socketToRoom:new Map(),enabled:true});
 await runner.tick();
});
test('tournament writes are service_role only and all new game rows protected by RLS',()=>{
 assert.match(sql,/ALTER TABLE public\.chess_club_tournament_games ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/GRANT SELECT ON TABLE public\.chess_club_tournament_games TO authenticated/);
 assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE) ON TABLE public\.chess_club_tournament_games TO authenticated/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.chess_club_tournament_transition\([\s\S]*?FROM PUBLIC,anon,authenticated/);
 assert.match(sql,/UNIQUE\(tournament_id,round_no,board_no\)/);
 assert.match(sql,/room_id uuid UNIQUE/);
 assert.match(sql,/match_id uuid UNIQUE/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/m\.result NOT IN \('1-0','0-1','1\/2-1\/2'\)/);
});
