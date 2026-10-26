import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { RootOptions } from 'react-dom/client'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import '@fontsource/inter/900.css'
import './index.css'
import App from './App.tsx'

// Preserve the recovery intent if the auth provider falls back to its Site URL.
// Route before React/Supabase mounts so URL fragments cannot be consumed first.
const incomingFragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const incomingQuery = new URLSearchParams(window.location.search);
if (window.location.pathname !== '/update-password' &&
  (incomingFragment.get('type') === 'recovery' || incomingQuery.get('type') === 'recovery')) {
  window.history.replaceState(null, '', '/update-password' + window.location.search + window.location.hash);
}

function render(options?: RootOptions) {
  createRoot(document.getElementById('root')!, options).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

if (import.meta.env.VITE_SENTRY_DSN?.trim()) {
  void import('./monitoring/sentry.ts')
    .then(({ initializeFrontendMonitoring }) => initializeFrontendMonitoring(import.meta.env))
    .then(render, () => render())
} else {
  render()
}
