'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {parseRss,createNewsHandler}=require('./clubsNrwNews');
test('RSS title and link only; foreign links and markup rejected',()=>{
 const xml='<rss><channel><item><title><![CDATA[Blitz &amp; Schach]]></title><link>https://sbboblog.wordpress.com/2026/10/a/</link><description>Secret</description></item><item><title>Bad</title><link>https://evil.example/</link></item></channel></rss>';
 assert.deepEqual(parseRss(xml),[{title:'Blitz & Schach',url:'https://sbboblog.wordpress.com/2026/10/a/'}]);});
test('fixed feed origin, response is cached, failures return empty items',async()=>{
 let calls=0;const handler=createNewsHandler({now:()=>100,fetcher:async url=>{calls++;assert.equal(url,'https://sbboblog.wordpress.com/feed/');return {ok:true,headers:{get:()=>null},body:new Response('<rss><item><title>Hello</title><link>https://sbboblog.wordpress.com/p/</link></item></rss>').body};}});
 let answer;const res={json(v){answer=v;return v;}};
 await handler({},res);await handler({},res);assert.equal(calls,1);assert.equal(answer.items.length,1);
 const fail=createNewsHandler({fetcher:async()=>{throw new Error('network')}});await fail({},res);assert.deepEqual(answer,{items:[]});
});

test('oversized chunked RSS is rejected before reading the entire body',async()=>{
 let reads=0;const handler=createNewsHandler({fetcher:async()=>({ok:true,headers:{get:()=>null},body:new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(130000));if(reads>3)controller.close();}})})});
 let result;await handler({}, {json(x){result=x;return x;}});assert.deepEqual(result,{items:[]});assert.equal(reads<=3,true);
});
