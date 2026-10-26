'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const path=require('node:path');
const sql=readFileSync(path.join(__dirname,'../supabase/migrations/20261026224500_clubs_nrw_v1.sql'),'utf8');
const index=readFileSync(path.join(__dirname,'index.js'),'utf8');
test('NRW migrations are additive, RLS enabled, no live game activation',()=>{
 for(const n of ['clubs_nrw','clubs_nrw_members','clubs_nrw_roles','clubs_nrw_calendar','clubs_nrw_league_rows','clubs_nrw_room_links','clubs_nrw_duels'])assert.match(sql,new RegExp('ALTER TABLE public\\.'+n+' ENABLE ROW LEVEL SECURITY','i'));
 assert.match(sql,/public_roster boolean NOT NULL DEFAULT false/);
 assert.match(sql,/CHECK\(status IN \('proposed','withdrawn'\)\)/);
 assert.doesNotMatch(sql,/(?:INSERT INTO public\.matches|ALTER TABLE public\.matches|socket\.on\(|CREATE EXTENSION|cron\.schedule)/i);
 assert.match(sql,/to_jsonb\(c\)->>'kind'='room'/);
 assert.match(sql,/r\.role IN \('admin','owner'\)/);
 assert.match(index,/process\.env\.CLUBS_NRW_ENABLED === 'true'/);
});
