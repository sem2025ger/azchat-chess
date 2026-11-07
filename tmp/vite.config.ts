import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'chessaz-build-commit',
    apply: 'build',
    transformIndexHtml() {
      const commit = process.env.VERCEL_GIT_COMMIT_SHA;
      if (!commit || !/^[a-f0-9]{40}$/.test(commit)) return [];
      return [{ tag: 'meta', attrs: { name: 'chessaz-commit', content: commit }, injectTo: 'head' }];
    },
  }],
  base: '/',
})
