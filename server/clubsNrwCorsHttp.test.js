'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
process.env.NODE_ENV='test';
process.env.CLUBS_NRW_ENABLED='true';
const upstream=globalThis.fetch;
globalThis.fetch=async()=>new Response('<rss><channel><item><title>Schachnachrichten</title><link>https://sbboblog.wordpress.com/2026/10/news/</link></item></channel></rss>',{status:200});
const {app,server,io,timeoutWatchdog}=require('./index');
globalThis.fetch=upstream;
test('real HTTP: news is CORS-allowed only for approved origin',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url='http://127.0.0.1:'+server.address().port+'/api/clubs-nrw/news';
    const good=await fetch(url,{headers:{Origin:'https://chessaz.de'}});
    assert.equal(good.status,200);
    assert.equal(good.headers.get('access-control-allow-origin'),'https://chessaz.de');
    const bad=await fetch(url,{headers:{Origin:'https://foreign.example'}});
    assert.equal(bad.status,200);
    assert.equal(bad.headers.get('access-control-allow-origin'),null);
  }finally{
    await new Promise(resolve=>io.close(resolve));
    if(server.listening)await new Promise(resolve=>server.close(resolve));
    clearInterval(timeoutWatchdog);
  }
});
