import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';

test('build publishes only a valid full Vercel commit in one HTML meta', async () => {
  const root = await mkdtemp(join(tmpdir(), 'chessaz-build-commit-'));
  const previous = process.env.VERCEL_GIT_COMMIT_SHA;
  const deployment = process.env.VERCEL_DEPLOYMENT_ID;
  try {
    await writeFile(join(root, 'index.html'), '<html><head></head><body>Fixture</body></html>');
    process.env.VERCEL_DEPLOYMENT_ID = 'private-build-metadata-fixture';
    for (const commit of ['a'.repeat(40), undefined, 'a'.repeat(7), '<script>bad</script>']) {
      if (commit === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
      else process.env.VERCEL_GIT_COMMIT_SHA = commit;
      await build({ configFile: resolve('vite.config.ts'), root, logLevel: 'silent',
        build: { outDir: join(root, 'dist'), emptyOutDir: true } });
      const html = await readFile(join(root, 'dist/index.html'), 'utf8');
      const tags = html.match(/<meta\b[^>]*>/g) ?? [];
      assert.deepEqual(tags, commit === 'a'.repeat(40)
        ? ['<meta name="chessaz-commit" content="' + commit + '">'] : []);
      assert.doesNotMatch(html, /private-build-metadata-fixture|<script>bad<\/script>/);
    }
  } finally {
    if (previous === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previous;
    if (deployment === undefined) delete process.env.VERCEL_DEPLOYMENT_ID;
    else process.env.VERCEL_DEPLOYMENT_ID = deployment;
    await rm(root, { recursive: true, force: true });
  }
});
