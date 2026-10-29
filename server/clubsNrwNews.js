'use strict';
// Public RSS only: Schachbezirk Bochum WordPress blog, title and article URL.
// Fixed origin prevents SSRF. Never forward arbitrary user-provided URLs.
const RSS_URL='https://sbboblog.wordpress.com/feed/';
function decode(value) {
 return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,Number(n))))
  .replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,parseInt(n,16))))
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/<[^>]*>/g,'').trim();
}
function parseRss(xml) {
 if(typeof xml!=='string'||xml.length>250000) return [];
 return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].slice(0,8).flatMap(([,item])=>{
  const title=item.match(/<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/)?.[1];
  const link=item.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/)?.[1];
  if(!title||!link)return [];
  const t=decode(title).slice(0,160), raw=decode(link);
  try { const url=new URL(raw);if(url.protocol!=='https:'||url.hostname!=='sbboblog.wordpress.com'||!t)return [];
   return [{title:t,url:url.href}]; }catch{return [];}
 });
}
function createNewsHandler({fetcher=fetch,now=Date.now}={}) {
 let cached={until:0,items:[]};let inflight=null;
 return async(_req,res)=>{
  if(cached.until>now())return res.json({items:cached.items});
  if(!inflight)inflight=(async()=>{const controller=new AbortController();
   const timeout=setTimeout(()=>controller.abort(),5000);
   try{const r=await fetcher(RSS_URL,{signal:controller.signal,redirect:'error',headers:{Accept:'application/rss+xml,application/xml'}});
    if(!r.ok||Number(r.headers?.get('content-length')||0)>250000)throw new Error('feed_unavailable');
    const chunks=[];let size=0;
    if(!r.body || typeof r.body.getReader!=='function') throw new Error('feed_unavailable');
    const reader=r.body.getReader();
    try { while(true) { const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength; if(size>250000) throw new Error('feed_too_large'); chunks.push(value);
    } } finally { if(size>250000) await reader.cancel().catch(()=>{}); reader.releaseLock(); }
    const xml=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks.map(x=>Buffer.from(x))));
    cached={until:now()+900000,items:parseRss(xml)};}
   catch{cached={until:now()+60000,items:[]};}
   finally{clearTimeout(timeout);}
  })().finally(()=>{inflight=null;});
  await inflight;return res.json({items:cached.items});
 };
}
module.exports={parseRss,createNewsHandler,RSS_URL};
