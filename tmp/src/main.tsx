import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import type { RootOptions } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
