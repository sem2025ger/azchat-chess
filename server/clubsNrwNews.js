'use strict';
// The default response continues to use the original Bochum feed and parser.
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
  if(!inflight)inflight=(async()=>{
   try {
    const xml = await fetchXml(RSS_URL, fetcher, 'application/rss+xml,application/xml');
    cached={until:now()+900000,items:parseRss(xml)};
   } catch {
    cached={until:now()+60000,items:[]};
   }
  })().finally(()=>{inflight=null;});
  await inflight;return res.json({items:cached.items});
 };
}
const MAX_BYTES = 250_000;
const CACHE_MS = 15 * 60_000;
const RETRY_MS = 60_000;
const MAX_AGE_MS = 120 * 24 * 60 * 60_000;

// Official discovery is documented in docs/clubs-nrw-v1.md. Confirm new URLs
// against that process before adding them. No network targets are read at runtime.
const OFFICIAL_FEEDS = [
 { id: 'schachbund-nrw', name: 'Schachbund Nordrhein-Westfalen', shortName: 'Schachbund NRW', category: 'landesverband', region: 'nrw', feedUrl: 'https://schach-nrw.de/feed/', allowedHosts: ['schach-nrw.de'] },
 { id: 'schachjugend-nrw', name: 'Schachjugend NRW', shortName: 'Schachjugend NRW', category: 'jugend_schule', region: 'nrw', feedUrl: 'https://sjnrw.de/?format=feed&type=atom', allowedHosts: ['sjnrw.de'] },
 { id: 'sv-ruhrgebiet', name: 'Schachverband Ruhrgebiet', shortName: 'SV Ruhrgebiet', category: 'region', region: 'ruhrgebiet', feedUrl: 'https://svr-schach.de/feed', allowedHosts: ['svr-schach.de'] },
 { id: 'nsv-niederrhein', name: 'Niederrheinischer Schachverband 1901', shortName: 'NSV Niederrhein', category: 'region', region: 'niederrhein', feedUrl: 'https://www.nsv1901.de/feed/', allowedHosts: ['www.nsv1901.de'] },
 { id: 'sv-mittelrhein', name: 'Schachverband Mittelrhein', shortName: 'SV Mittelrhein', category: 'region', region: 'mittelrhein', feedUrl: 'https://sv-mittelrhein.de/feed', allowedHosts: ['sv-mittelrhein.de'] },
 { id: 'sv-owl', name: 'Schachverband Ostwestfalen-Lippe', shortName: 'SV Ostwestfalen-Lippe', category: 'region', region: 'owl', feedUrl: 'https://schachverband-owl.de/feed/', allowedHosts: ['schachverband-owl.de'] },
 { id: 'sv-muensterland', name: 'Schachverband Münsterland', shortName: 'SV Münsterland', category: 'region', region: 'muensterland', feedUrl: 'https://www.svmuensterland.de/?format=feed&type=rss', allowedHosts: ['www.svmuensterland.de'] },
 { id: 'sv-suedwestfalen', name: 'Schachverband Südwestfalen', shortName: 'SV Südwestfalen', category: 'region', region: 'suedwestfalen', feedUrl: 'https://schach-swf.de/index.php?format=feed&type=rss', allowedHosts: ['schach-swf.de'] },
 { id: 'schachbezirk-bochum', name: 'Schachbezirk Bochum', shortName: 'Schachbezirk Bochum', category: 'region', region: 'bochum', feedUrl: RSS_URL, allowedHosts: ['sbboblog.wordpress.com'] },
 { id: 'bochumer-sv-02', name: 'Bochumer Schachverein 02', shortName: 'Bochumer SV 02', category: 'region', region: 'bochum', feedUrl: 'https://bochumersv02.de/feed/', allowedHosts: ['bochumersv02.de'] },
];

async function fetchXml(url, fetcher, accept) {
 const response = await fetcher(url, {
  signal: AbortSignal.timeout(5_000),
  redirect: 'error',
  headers: { Accept: accept },
 });
 if (!response.ok || Number(response.headers?.get('content-length') || 0) > MAX_BYTES || !response.body?.getReader) {
  throw new Error('feed_unavailable');
 }
 const reader = response.body.getReader();
 const chunks = [];
 let size = 0;
 try {
  for (;;) {
   const { done, value } = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > MAX_BYTES) throw new Error('feed_too_large');
   chunks.push(value);
  }
 } finally {
  if (size > MAX_BYTES) await reader.cancel().catch(() => {});
  reader.releaseLock();
 }
 return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size));
}

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(value) {
 return value.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (entity, key) => {
  if (!key.startsWith('#')) return Object.hasOwn(entities, key) ? entities[key] : entity;
  const point = Number(key[1].toLowerCase() === 'x' ? '0x' + key.slice(2) : key.slice(1));
  return point > 0 && point <= 0x10ffff && (point < 0xd800 || point > 0xdfff)
   ? String.fromCodePoint(point) : '\uFFFD';
 });
}

function makeItem(fields, feed) {
 const title = Array.from(decodeEntities(decodeEntities(fields.title || '')).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 160).join('');
 const url = URL.parse(decodeEntities((fields.link || '').trim()));
 if (!title || !url || url.protocol !== 'https:' || url.username || url.password || url.port || !feed.allowedHosts.includes(url.hostname)) return null;
 url.hash = '';
 const date = [fields.pubDate, fields.updated, fields.published].map(Date.parse).find(Number.isFinite);
 return {
  title, url: url.href, sourceId: feed.id, source: feed.name, shortName: feed.shortName,
  category: feed.category, region: feed.region, publishedAt: date === undefined ? null : new Date(date).toISOString(),
 };
}

// Only direct headline fields are retained. The bounded tokenizer checks nesting
// and ignores every other field, with no DTD, entity declarations, or external loads.
function parseOfficialFeed(xml, feed) {
 if (!xml || Buffer.byteLength(xml) > MAX_BYTES) throw new Error('feed_invalid');
 const tokens = /<!--[^]*?-->|<!\[CDATA\[[^]*?\]\]>|<\?xml\s[^]*?\?>|<\/?[\w:.-]+(?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*\/?>|[^<]+/gy;
 const stack = [];
 const items = [];
 let root;
 let fields;
 let itemDepth;
 let capture;
 let cursor = 0;
 while (cursor < xml.length) {
  const token = tokens.exec(xml)?.[0];
  if (!token) throw new Error('feed_invalid');
  cursor = tokens.lastIndex;
  if (token.startsWith('<!--') || token.startsWith('<?xml')) continue;
  if (token.startsWith('<![CDATA[') || !token.startsWith('<')) {
   if (!stack.length && token.trim()) throw new Error('feed_invalid');
   if (capture && (stack.length === itemDepth + 1 || capture === 'title')) fields[capture] += token.startsWith('<![') ? token.slice(9, -3) : token;
   continue;
  }
  const [, name] = token.match(/^<\/?([\w:.-]+)/);
  const local = name.split(':').at(-1);
  if (token.startsWith('</')) {
   if (stack.pop() !== name) throw new Error('feed_invalid');
   if (fields && stack.length === itemDepth) capture = undefined;
   if (fields && stack.length === itemDepth - 1) {
    const item = makeItem(fields, feed);
    if (item) items.push(item);
    fields = undefined;
   }
   continue;
  }
  if (!stack.length) {
   if (root || !['rss', 'feed', 'RDF'].includes(local)) throw new Error('feed_invalid');
   root = local;
  }
  const depth = stack.length + 1;
  const isEntry = (root === 'feed' && depth === 2 && local === 'entry')
   || (root === 'rss' && depth === 3 && stack[1] === 'channel' && local === 'item')
   || (root === 'RDF' && depth === 2 && local === 'item');
  if (isEntry && !token.endsWith('/>')) {
   fields = {};
   itemDepth = depth;
  } else if (fields && depth === itemDepth + 1 && ['title', 'link', 'pubDate', 'updated', 'published'].includes(local)) {
   if (local === 'link' && root === 'feed') {
    const attrs = [...token.matchAll(/\s([\w:.-]+)\s*=\s*(["'])(.*?)\2/gs)];
    const rel = attrs.find(match => match[1] === 'rel')?.[3];
    const href = attrs.find(match => match[1] === 'href')?.[3];
    if (!fields.link && (!rel || rel === 'alternate')) {
     if (href) fields.link = href;
     else if (!token.endsWith('/>')) {
      capture = 'link';
      fields.link = '';
     }
    }
   } else if (!token.endsWith('/>') && fields[local] === undefined) {
    capture = local;
    fields[capture] = '';
   }
  }
  if (!token.endsWith('/>')) stack.push(name);
 }
 if (!root || stack.length) throw new Error('feed_invalid');
 return items;
}

function createAggregatedNewsHandler(fetcher, now) {
 const records = new Map();
 let merged;
 let inflight;

 async function refresh() {
  const due = OFFICIAL_FEEDS.filter(feed => (records.get(feed.id)?.until ?? -Infinity) <= now());
  const results = await Promise.allSettled(due.map(async feed => parseOfficialFeed(
   await fetchXml(feed.feedUrl, fetcher, 'application/rss+xml,application/atom+xml,application/xml'),
   feed,
  )));
  const checkedAt = now();
  due.forEach((feed, index) => {
   const result = results[index];
   const items = result.status === 'fulfilled' ? result.value : [];
   records.set(feed.id, { until: checkedAt + (result.status === 'rejected' ? RETRY_MS : CACHE_MS), items });
  });
  const cutoff = new Date(checkedAt - MAX_AGE_MS).toISOString();
  const available = [...records.values()].map(record => record.items.filter(item => !item.publishedAt || item.publishedAt >= cutoff));
  const sorted = available.flat().sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
  const urls = new Set();
  const perSource = new Map();
  const items = [];
  for (const item of sorted) {
   const count = perSource.get(item.sourceId) || 0;
   if (count >= 5 || urls.has(item.url)) continue;
   items.push(item);
   urls.add(item.url);
   perSource.set(item.sourceId, count + 1);
   if (items.length === 30) break;
  }
  merged = {
   until: Math.min(...[...records.values()].map(record => record.until)),
   response: { items, updatedAt: new Date(checkedAt).toISOString(), sourcesOk: available.filter(list => list.length).length },
  };
 }

 return async (_req, res) => {
  if (!merged || merged.until <= now()) {
   if (!inflight) inflight = refresh().finally(() => { inflight = null; });
   await inflight;
  }
  return res.json(merged.response);
 };
}

function createNrwNewsHandler({ enabled = false, fetcher = fetch, now = Date.now } = {}) {
 return enabled ? createAggregatedNewsHandler(fetcher, now) : createNewsHandler({ fetcher, now });
}

module.exports = { parseRss, createNewsHandler, RSS_URL, parseOfficialFeed, createNrwNewsHandler };
