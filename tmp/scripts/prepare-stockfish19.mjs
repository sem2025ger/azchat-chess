// Stage unmodified upstream binaries. Hashes are reviewed in git, never trusted
// from mutable release metadata at build time. No production secrets required.
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const tag = 'v19.0.1';
const base = 'https://github.com/nmrugg/stockfish.js/releases/download/' + tag + '/';
export const artifacts = Object.freeze([
  Object.freeze({ name: 'stockfish-19-lite-single.js', size: 28230,
    sha256: 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a' }),
  Object.freeze({ name: 'stockfish-19-lite-single.wasm', size: 1845971,
    sha256: 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de' }),
]);

export function verifyAsset(name, bytes) {
  const asset = artifacts.find(item => item.name === name);
  if (!asset) throw new Error('Unknown Stockfish artifact: ' + name);
  if (bytes.length !== asset.size) throw new Error('Invalid Stockfish asset length: ' + name);
  if (name.endsWith('.wasm') && bytes.subarray(0, 4).toString('hex') !== '0061736d') {
    throw new Error('Stockfish WebAssembly signature mismatch');
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== asset.sha256) throw new Error('Stockfish integrity check failed: ' + name);
  return hash;
}

export async function prepareStockfish19({ destination = resolve('public'), fetchImpl = fetch } = {}) {
  // Verify both downloads before writing either asset into the output directory.
  const assets = await Promise.all(artifacts.map(async ({ name }) => {
    const response = await fetchImpl(base + name, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error('Stockfish download failed (HTTP ' + response.status + ')');
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = verifyAsset(name, bytes);
    return { name, bytes, hash };
  }));
  await mkdir(destination, { recursive: true });
  for (const { name, bytes, hash } of assets) {
    await writeFile(resolve(destination, name), bytes);
    console.log('Verified Stockfish 19 release ' + tag + ': ' + name + ' sha256=' + hash);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await prepareStockfish19();
}
