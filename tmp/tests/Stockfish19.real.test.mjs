import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const js = fileURLToPath(new URL('../public/stockfish-19-lite-single.js', import.meta.url));
const wasm = fileURLToPath(new URL('../public/stockfish-19-lite-single.wasm', import.meta.url));

test('real, checksum-verified Stockfish 19 initializes and analyzes 3 UCI lines', { timeout: 55_000 }, async () => {
  const expected = [
    [js, 28230, 'ccb130d7ff29408531c47d859a49f91d59d4f482d05a53eb1a3231a4f624c91a'],
    [wasm, 1845971, 'ee4f115bdb2d32cadf96cada104a05b5ec257d7ad6f57582190b49bc71f096de'],
  ];
  for (const [path, size, sha] of expected) {
    const bytes = await readFile(path);
    assert.equal(bytes.length, size, path + ' byte count');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha, path + ' authenticity');
  }

  const proc = spawn(process.execPath, [js], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buffer = '';
  let name = '';
  let gotUci = false;
  let gotReady = false;
  const multiPvSeen = new Set();
  let bestMove = '';
  const stderr = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Stockfish 19 UCI timeout: ' + stderr.join('').slice(-300))), 38_000);
      const finish = (error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
      proc.on('error', finish);
      proc.on('exit', (code) => finish(new Error('Stockfish 19 exited prematurely: ' + code)));
      proc.stderr.on('data', data => { stderr.push(String(data).slice(-1000)); });
      proc.stdout.on('data', chunk => {
        buffer += String(chunk);
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('id name ')) name = line.slice(8);
          if (line.trim() === 'uciok') {
            gotUci = true;
            proc.stdin.write('isready\n');
          }
          if (line.trim() === 'readyok') {
            gotReady = true;
            proc.stdin.write('setoption name MultiPV value 3\nposition startpos\ngo depth 6\n');
          }
          const mp = line.match(/^info .*?\bmultipv\s+([1-3])\b/);
          if (mp) multiPvSeen.add(Number(mp[1]));
          const bm = line.match(/^bestmove\s+([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (bm) { bestMove = bm[1]; finish(); return; }
        }
      });
      proc.stdin.write('uci\n');
    });
    assert.match(name, /Stockfish\s+19/i);
    assert.ok(gotUci && gotReady, 'real UCI handshake completed');
    assert.match(bestMove, /^[a-h][1-8][a-h][1-8][qrbn]?$/);
    assert.deepEqual([...multiPvSeen].sort(), [1, 2, 3], 'three real MultiPV streams');
  } finally {
    proc.stdin.end();
    proc.kill('SIGTERM');
  }
});
