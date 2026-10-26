'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {app,server,io,timeoutWatchdog}=require('./index');
test('real HTTP application: CORS whitelist for clubs news',async()=>{
 const prior=process.env.CLUBS_NRW_ENABLED;
 // The route is registered at boot, so CI must run this test with its enabled fixture.
 // In a disabled build assert 404 remains gated; HTTP must still respect same CORS.
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const url='http://127.0.0.1:'+server.address().port+'/api/clubs-nrw/news';
  const allowed=await fetch(url,{headers:{Origin:'https://chessaz.de'}});
  assert.equal(allowed.headers.get('access-control-allow-origin'),'https://chessaz.de');
  const foreign=await fetch(url,{headers:{Origin:'https://evil.example'}});
  assert.equal(foreign.headers.get('access-control-allow-origin'),null);
  assert.equal(foreign.status,404); // Default-off test mode: endpoint cannot fetch RSS.
 } finally { await new Promise(resolve=>io.close(resolve)); if(server.listening)await new Promise(resolve=>server.close(resolve));clearInterval(timeoutWatchdog); }
});
