// Fetch the exact Stockfish.js 19 Lite Single release artifacts during the frontend build.
// Never use an unpinned CDN URL at runtime. No production secrets required.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const tag = 'v19.0.1';
const base = 'https://github.com/nmrugg/stockfish.js/releases/download/' + tag + '/';
const names = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];
const api = 'https://api.github.com/repos/nmrugg/stockfish.js/releases/tags/' + tag;

async function fetchVerified(url, headers = {}) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error('Stockfish download failed (HTTP ' + response.status + ')');
  return response;
}
const release = await (await fetchVerified(api, {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'ChessAZ-Stockfish-19-Build'
})).json();
if (release.tag_name !== tag || !Array.isArray(release.assets)) {
  throw new Error('Unexpected Stockfish release metadata');
}

const assets = await Promise.all(names.map(async name => {
  const asset = release.assets.find(item => item.name === name);
  if (!asset || asset.browser_download_url !== base + name ||
      !/^sha256:[0-9a-f]{64}$/i.test(asset.digest ?? '')) {
    throw new Error('Missing or unverifiable Stockfish 19 artifact: ' + name);
  }
  const bytes = Buffer.from(await (await fetchVerified(base + name)).arrayBuffer());
  if (bytes.byteLength !== asset.size || bytes.length < (name.endsWith('.wasm') ? 100_000 : 5_000) ||
      bytes.length > 5_000_000) throw new Error('Invalid Stockfish asset length: ' + name);
  if (name.endsWith('.wasm') && bytes.subarray(0, 4).toString('hex') !== '0061736d') {
    throw new Error('Stockfish WebAssembly signature mismatch');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if ('sha256:' + hash !== asset.digest.toLowerCase()) {
    throw new Error('Stockfish integrity check failed: ' + name);
  }
  return { name, bytes, hash };
}));

const destination = resolve('public');
await mkdir(destination, { recursive: true });
for (const { name, bytes, hash } of assets) {
  await writeFile(resolve(destination, name), bytes);
  console.log('Verified Stockfish 19 release ' + tag + ': ' + name + ' sha256=' + hash);
}
