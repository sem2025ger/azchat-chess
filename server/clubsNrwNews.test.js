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

const { parseOfficialFeed, createNrwNewsHandler, RSS_URL } = require('./clubsNrwNews');
const now = Date.parse('2026-11-23T12:00:00Z');
const feed = {
 id: 'bochumer-sv-02', name: 'Bochumer Schachverein 02', shortName: 'Bochumer SV 02',
 region: 'bochum', category: 'region', allowedHosts: ['bochumersv02.de'],
};
const rss = (...entries) => `<rss><channel>${entries.join('')}</channel></rss>`;
const story = (url, date = '', title = 'Schach &amp; Verein') =>
 `<item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description>Article body</description></item>`;
const reply = handler => handler({}, { json: data => data });

test('official RSS extracts only headline fields, validates the origin and supports undated items', () => {
 const xml = rss(
  story('https://bochumersv02.de/turnier/?a=1&amp;b=2#top', 'Mon, 23 Nov 2026 10:00:00 +0000', '<![CDATA[<b>Turnier</b> &#8211; Stadt &amp; Schach]]>'),
  story('http://bochumersv02.de/insecure'),
  story('https://not-bochumersv02.de/foreign'),
  story('https://username@bochumersv02.de/credential'),
  story('https://bochumersv02.de:1234/alternate-port'),
  story('https://bochumersv02.de/undated', 'not a date', '♙'.repeat(170)),
 );
 assert.deepEqual(parseOfficialFeed(xml, feed), [
  {
   title: 'Turnier – Stadt & Schach', url: 'https://bochumersv02.de/turnier/?a=1&b=2',
   sourceId: feed.id, source: feed.name, shortName: feed.shortName,
   category: 'region', region: 'bochum', publishedAt: '2026-11-23T10:00:00.000Z',
  },
  {
   title: '♙'.repeat(160), url: 'https://bochumersv02.de/undated',
   sourceId: feed.id, source: feed.name, shortName: feed.shortName,
   category: 'region', region: 'bochum', publishedAt: null,
  },
 ]);
});

test('official RSS repairs the Münsterland article query without altering normal encoded URLs', () => {
 const host = 'https://www.svmuensterland.de';
 const feedSource = { ...feed, allowedHosts: ['www.svmuensterland.de'] };
 const original = host + '/%3Fview%3Darticle%26amp%3Bid%3D341%3Af%C3%BCr-kurzentschlossene-2%26amp%3Bcatid%3D2';
 const normal = host + '/news%20article/?id=3&amp;catid=2';
 const items = parseOfficialFeed(rss(story(original), story(normal)), feedSource);
 assert.deepEqual(items.map(item => item.url), [
  host + '/?view=article&id=341:f%C3%BCr-kurzentschlossene-2&catid=2',
  host + '/news%20article/?id=3&catid=2',
 ]);
});

test('official RSS drops broken, empty or foreign destinations after attempted path repair', () => {
 const xml = rss(
  story('https://bochumersv02.de/%3Fid%3D%E0%A4'),
  story('https://bochumersv02.de/%3F'),
  story('https://bochumersv02.de/%2Fforeign.example/%26amp%3B'),
  story('https://bochumersv02.de/%2Fvisitor@bochumersv02.de/%26amp%3B'),
  story('https://bochumersv02.de/%2Fbochumersv02.de:1234/%26amp%3B'),
 );
 assert.deepEqual(parseOfficialFeed(xml, feed), []);
});

test('official Atom accepts alternate links, prefixed entries and published date fallback', () => {
 const xml = `<?xml version="1.0"?><a:feed xmlns:a="http://www.w3.org/2005/Atom">
  <a:entry><a:title>Bochum &#x2659;</a:title>
   <a:link rel="self" href="https://bochumersv02.de/feed/"/>
   <a:link href='https://bochumersv02.de/news' rel='alternate'/>
   <a:updated>invalid</a:updated><a:published>2026-11-23T13:00:00+01:00</a:published>
  </a:entry><a:entry><a:title>Second</a:title><a:link>https://bochumersv02.de/second</a:link>
   <a:updated>2026-11-23T13:00:00+02:00</a:updated>
  </a:entry></a:feed>`;
 const [first, second] = parseOfficialFeed(xml, feed);
 assert.equal(first.title, 'Bochum ♙');
 assert.equal(first.url, 'https://bochumersv02.de/news');
 assert.equal(first.publishedAt, '2026-11-23T12:00:00.000Z');
 assert.equal(second.url, 'https://bochumersv02.de/second');
 assert.equal(second.publishedAt, '2026-11-23T11:00:00.000Z');
});

test('official parser rejects HTML, malformed XML, DTDs and oversized byte payloads', () => {
 for (const xml of ['<html/>', '<rss><channel></rss>', '<!DOCTYPE rss><rss/>', '<rss>' + 'ä'.repeat(125_000) + '</rss>']) {
  assert.throws(() => parseOfficialFeed(xml, feed), /feed_invalid/);
 }
});

test('one unavailable feed and one oversized feed are isolated and retry after one minute', async () => {
 let clock = now;
 let attempts = new Map();
 let oversizedReads = 0;
 let oversizedCanceled = false;
 const slowUrl = 'https://svr-schach.de/feed';
 const bigUrl = 'https://www.nsv1901.de/feed/';
 const handler = createNrwNewsHandler({ enabled: true, now: () => clock, fetcher: async (url, options) => {
  assert.equal(new URL(url).protocol, 'https:');
  assert.equal(options.redirect, 'error');
  assert.ok(options.signal instanceof AbortSignal);
  attempts.set(url, (attempts.get(url) || 0) + 1);
  if (url === slowUrl && attempts.get(url) === 1) throw new Error('network');
  if (url === bigUrl) return new Response(new ReadableStream({
   pull(controller) { oversizedReads++; controller.enqueue(new Uint8Array(130_000)); },
   cancel() { oversizedCanceled = true; },
  }));
  return new Response(rss(story(new URL(url).origin + '/headline', new Date(now).toISOString())));
 } });
 const [first, concurrent] = await Promise.all([reply(handler), reply(handler)]);
 assert.deepEqual(first, concurrent);
 assert.equal(first.sourcesOk, 8);
 assert.equal(first.items.length, 8);
 assert.equal(first.updatedAt, new Date(now).toISOString());
 assert.ok(first.items.some(item => item.region === 'bochum' && item.sourceId === feed.id));
 assert.ok(oversizedReads <= 3);
 assert.ok(oversizedCanceled);
 assert.equal(attempts.size, 10);
 assert.ok([...attempts.values()].every(count => count === 1));
 clock += 59_999;
 assert.equal(await reply(handler), first);
 clock++;
 const second = await reply(handler);
 assert.equal(second.sourcesOk, 9);
 assert.equal(second.updatedAt, new Date(clock).toISOString());
 assert.equal(attempts.get(slowUrl), 2);
 assert.equal(attempts.get(bigUrl), 2);
 assert.equal(attempts.get(RSS_URL), 1);
 clock = now + 900_000;
 await reply(handler);
 assert.equal(attempts.get(RSS_URL), 2);
});

test('a valid feed without usable items is cached for 15 minutes while a failed feed retries after one minute', async () => {
 const emptyUrl = 'https://bochumersv02.de/feed/';
 const failedUrl = 'https://svr-schach.de/feed';
 const attempts = new Map();
 let clock = now;
 const handler = createNrwNewsHandler({ enabled: true, now: () => clock, fetcher: async url => {
  const count = (attempts.get(url) || 0) + 1;
  attempts.set(url, count);
  if (url === failedUrl && count === 1) throw new Error('network');
  const link = new URL('/headline', url).href;
  return new Response(rss(url === emptyUrl ? story(link, '', '') : story(link)));
 } });

 const first = await reply(handler);
 assert.ok(!first.items.some(item => item.sourceId === feed.id));
 assert.deepEqual([attempts.get(emptyUrl), attempts.get(failedUrl)], [1, 1]);

 clock = now + 59_999;
 assert.equal(await reply(handler), first);
 clock = now + 60_000;
 await reply(handler);
 assert.equal(attempts.get(failedUrl), 2);
 assert.equal(attempts.get(emptyUrl), 1);

 clock = now + 899_999;
 await reply(handler);
 assert.equal(attempts.get(emptyUrl), 1);
 clock = now + 900_000;
 await reply(handler);
 assert.equal(attempts.get(emptyUrl), 2);
} );

test('merged output deduplicates canonical URLs, sorts, applies the age cutoff and enforces both caps', async () => {
 const handler = createNrwNewsHandler({ enabled: true, now: () => now, fetcher: async url => {
  const { origin } = new URL(url);
  const start = new Date(now - 120 * 86_400_000);
  return new Response(rss(
   story(origin + '/stale', new Date(start - 1).toISOString(), 'Stale'),
   story(origin + '/one#older', new Date(now - 1).toISOString(), 'Duplicate'),
   story(origin + '/one#newer', new Date(now).toISOString(), 'Newest'),
   story(origin + '/undated', '', 'Undated'),
   story(origin + '/boundary', start.toISOString(), '120 days'),
   ...Array.from({ length: 6 }, (_, index) => story(origin + '/dated-' + index, new Date(now - 1000 * (index + 1)).toISOString())),
  ));
 } });
 const { items } = await reply(handler);
 assert.equal(items.length, 30);
 assert.equal(new Set(items.map(item => item.url)).size, 30);
 assert.ok(items.every(item => !['Stale', 'Duplicate'].includes(item.title)));
 assert.ok(items.every((item, index) => !index || (items[index - 1].publishedAt || '') >= (item.publishedAt || '')));
 for (const id of new Set(items.map(item => item.sourceId))) assert.ok(items.filter(item => item.sourceId === id).length <= 5);

 const small = createNrwNewsHandler({ enabled: true, now: () => now, fetcher: async url => {
  if (url !== RSS_URL) throw new Error('unavailable');
  return new Response(rss(
   story('https://sbboblog.wordpress.com/stale', new Date(now - 120 * 86_400_000 - 1).toISOString(), 'Stale'),
   story('https://sbboblog.wordpress.com/undated', '', 'Undated'),
   story('https://sbboblog.wordpress.com/boundary', new Date(now - 120 * 86_400_000).toISOString(), '120 days'),
  ));
 } });
 assert.deepEqual((await reply(small)).items.map(item => item.title), ['120 days', 'Undated']);
});

test('flag off uses exactly the legacy JSON bytes on success, cache hit and failure', async () => {
 for (const fail of [false, true]) {
  let calls = 0;
  const fetcher = async (url, options) => {
   calls++;
   assert.equal(url, RSS_URL);
   assert.equal(options.headers.Accept, 'application/rss+xml,application/xml');
   if (fail) throw new Error('unavailable');
   return new Response(rss(story('https://sbboblog.wordpress.com/news', '', '<![CDATA[Blitz &amp; Schach]]>')));
  };
  const expected = fail ? '{"items":[]}' : '{"items":[{"title":"Blitz & Schach","url":"https://sbboblog.wordpress.com/news"}]}';
  for (const enabled of [undefined, false]) {
   const handler = createNrwNewsHandler({ enabled, fetcher, now: () => now });
   assert.equal(JSON.stringify(await reply(handler)), expected);
   assert.equal(JSON.stringify(await reply(handler)), expected);
  }
  assert.equal(calls, 2);
 }
});
