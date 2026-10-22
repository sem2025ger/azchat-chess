import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { artifacts, prepareStockfish19, verifyAsset } from '../scripts/prepare-stockfish19.mjs';

test('Stockfish staging rejects replaced binaries even when filename and length match', () => {
  for (const asset of artifacts) {
    const replaced = Buffer.alloc(asset.size);
    if (asset.name.endsWith('.wasm')) Buffer.from('0061736d', 'hex').copy(replaced);
    assert.throws(() => verifyAsset(asset.name, replaced), /integrity check failed/);
  }
});

test('Stockfish staging rejects truncation, HTML in place of WASM, and unknown assets', () => {
  assert.throws(() => verifyAsset(artifacts[0].name, Buffer.from('<html>error</html>')), /length/);
  assert.throws(() => verifyAsset(artifacts[1].name, Buffer.alloc(artifacts[1].size, 32)), /signature/);
  assert.throws(() => verifyAsset('stockfish-latest.js', Buffer.alloc(10)), /Unknown/);
});

test('HTTP failure does not stage unverified downloads or contact the release metadata API', async () => {
  const destination = await mkdtemp(join(tmpdir(), 'chessaz-integrity-'));
  const urls = [];
  try {
    await assert.rejects(prepareStockfish19({ destination, fetchImpl: async url => {
      urls.push(url);
      return { ok: false, status: 503 };
    } }), /HTTP 503/);
    assert.deepEqual(await readdir(destination), []);
    assert.equal(urls.length, 2);
    assert.ok(urls.every(url => url.startsWith('https://github.com/nmrugg/stockfish.js/releases/download/v19.0.1/')));
  } finally {
    await rm(destination, { recursive: true, force: true });
  }
});
