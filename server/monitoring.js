'use strict';

const {
  safeEnvironment, safeRelease, sanitizeBreadcrumb, sanitizeEnvelope,
  sanitizeEvent, persistenceDiagnostics, privateDataCollection,
} = require('./monitoringPrivacy');

const disabled = {
  enabled: false,
  captureException() {},
  capturePersistenceFailure() {},
  expressErrorHandler(error, req, res, next) { next(error); },
};

function createMonitoring({ env = process.env, loadSdk = () => require('@sentry/node') } = {}) {
  // Do not even require the SDK without a DSN (no listeners/instrumentation).
  if (typeof env.SENTRY_DSN !== 'string' || !env.SENTRY_DSN.trim()) return disabled;
  let sdk;
  try {
    sdk = loadSdk();
    const environment = safeEnvironment(env.SENTRY_ENVIRONMENT);
    const release = safeRelease(env.RENDER_GIT_COMMIT);
    sdk.init({
      dsn: env.SENTRY_DSN,
      environment,
      release,
      sendDefaultPii: false, // Legacy opt-out; SDK 11 uses dataCollection below.
      dataCollection: privateDataCollection(),
      defaultIntegrations: false,
      // No HTTP, Express, Supabase, console, session, source-context, local-
      // variable or performance instrumentation. HTTP errors use our passive
      // middleware, which forwards the original error to Express unchanged.
      integrations: [
        sdk.onUncaughtExceptionIntegration(),
        sdk.onUnhandledRejectionIntegration({ mode: 'strict' }),
      ],
      enableOpenTelemetrySetup: false,
      enableRuntimeChannelInjection: false,
      includeLocalVariables: false,
      tracesSampleRate: 0,
      traceLifecycle: 'static',
      tracePropagationTargets: [],
      profileSessionSampleRate: 0,
      sendClientReports: false,
      beforeSend(event) {
        const safe = sanitizeEvent(event);
        return safe ? { ...safe, environment, ...(release ? { release } : {}) } : null;
      },
      beforeBreadcrumb: sanitizeBreadcrumb,
      beforeSendTransaction: () => null,
      beforeSendLog: () => null,
      beforeSendMetric: () => null,
      transport(options) {
        const transport = sdk.makeNodeTransport(options);
        return {
          send(envelope) {
            const safe = sanitizeEnvelope(envelope);
            return safe ? transport.send(safe) : Promise.resolve({ statusCode: 200 });
          },
          flush: (timeout) => transport.flush(timeout),
        };
      },
    });
  } catch {
    // Monitoring is optional; SDK errors must not change HTTP or game behavior.
    return disabled;
  }

  const seenErrors = new WeakSet();
  function captureException(error) {
    try {
      if (error !== null && (typeof error === 'object' || typeof error === 'function')) {
        if (seenErrors.has(error)) return;
        seenErrors.add(error);
      }
      sdk.captureException(error);
    } catch {
      // Keep the existing error path even if the monitoring SDK fails.
    }
  }

  return {
    enabled: true,
    captureException,
    capturePersistenceFailure(diagnostics) {
      try {
        // Never pass the original Error, cause, record or matchId to the SDK.
        sdk.captureEvent({
          message: 'MATCH_PERSIST_FAILED',
          level: 'error',
          platform: 'node',
          extra: persistenceDiagnostics(diagnostics),
        });
      } catch {
        // Persistence retry/result/logging semantics remain unchanged.
      }
    },
    expressErrorHandler(error, req, res, next) {
      captureException(error);
      next(error);
    },
  };
}

let current = disabled;
function initializeMonitoring(options) {
  current = createMonitoring(options);
  return current;
}
function reportPersistenceFailure(diagnostics) {
  current.capturePersistenceFailure(diagnostics);
}

module.exports = { createMonitoring, initializeMonitoring, reportPersistenceFailure };
