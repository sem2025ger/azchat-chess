'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {isolatedPostgres}=require('./test-support/durablePostgres.cjs');
test('parallel isolated database fixtures provision an existing BYPASSRLS role without catalog write races',{
 skip:!process.env.CI&&!process.env.DURABLE_TEST_DATABASE_URL,timeout:30000
},async()=>{
 const fixtures=[];
 try{
  // All databases share pg_authid, even though each fixture has its own schema.
  const created=await Promise.allSettled(Array.from({length:4},()=>isolatedPostgres(process.env.DURABLE_TEST_DATABASE_URL)));
  for(const result of created)if(result.status==='fulfilled')fixtures.push(result.value);
  for(const result of created)if(result.status==='rejected')throw result.reason;
  for(const fixture of fixtures){const {rows}=await fixture.pool.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='service_role'");assert.equal(rows[0].rolbypassrls,true);}
 }finally{await Promise.all(fixtures.map(f=>f.close()));}
});
