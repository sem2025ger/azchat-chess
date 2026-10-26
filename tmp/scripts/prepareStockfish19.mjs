import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../public/', import.meta.url));
const release = 'v19.0.1';
const files = [
  {
    name: 'stockfish-19-lite-single.js',
    bytes: 28230,
    sha256: 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a',
  },
  {
    name: 'stockfish-19-lite-single.wasm',
    bytes: 1845971,
    sha256: 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de',
  },
];
const sources = [
  'https://github.com/nmrugg/stockfish.js/releases/download/' + release + '/',
  'https://cdn.jsdelivr.net/npm/stockfish@19.0.1/bin/',
  'https://unpkg.com/stockfish@19.0.1/bin/',
];
const verify = (bytes, file) => bytes.length === file.bytes &&
  createHash('sha256').update(bytes).digest('hex') === file.sha256;

await mkdir(root, { recursive: true });
for (const file of files) {
  const target = join(root, file.name);
  let existing = null;
  try { existing = await readFile(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing && verify(existing, file)) {
    console.log('Stockfish 19 verified (cached): ' + file.name);
    continue;
  }

  let downloaded = false;
  for (const base of sources) {
    const url = base + file.name;
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(25_000),
        headers: { 'User-Agent': 'ChessAZ-Stockfish19-Installer' },
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!verify(bytes, file)) throw new Error('SHA-256 or size mismatch');
      const temporary = target + '.download';
      try {
        await writeFile(temporary, bytes);
        await rename(temporary, target);
      } finally {
        await rm(temporary, { force: true });
      }
      console.log('Stockfish 19 verified: ' + file.name + ' (' + bytes.length + ' bytes)');
      downloaded = true;
      break;
    } catch (error) {
      console.warn('Stockfish 19 asset unavailable from ' + new URL(base).host + ': ' + error.message);
    }
  }
  if (!downloaded) throw new Error('Unable to install verified Stockfish 19: ' + file.name);
}
