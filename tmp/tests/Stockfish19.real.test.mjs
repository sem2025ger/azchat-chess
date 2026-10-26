import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const js = fileURLToPath(new URL('../public/stockfish-19-lite-single.js', import.meta.url));
const wasm = fileURLToPath(new URL('../public/stockfish-19-lite-single.wasm', import.meta.url));

test('official Stockfish 19 release binaries are authentic and compile as WebAssembly', { timeout: 55_000 }, async () => {
  const expected = [
    [js, 28230, 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a'],
    [wasm, 1845971, 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de'],
  ];
  for (const [path, size, sha] of expected) {
    const bytes = await readFile(path);
    assert.equal(bytes.length, size, path + ' byte count');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, path + ' authenticity');
  }

  const bytes = await readFile(wasm);
  const module = await WebAssembly.compile(bytes);
  assert.ok(module instanceof WebAssembly.Module, 'Official Stockfish 19 WebAssembly is valid');
  assert.ok(WebAssembly.Module.imports(module).length >= 0, 'WASM import metadata accessible');
});
