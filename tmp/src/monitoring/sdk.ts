// Export only error-monitoring APIs; no Replay/Feedback/Profiler APIs.
// No initialization happens at module import time.
export {
  init, globalHandlersIntegration, dedupeIntegration, makeFetchTransport, captureException,
} from '@sentry/react';
