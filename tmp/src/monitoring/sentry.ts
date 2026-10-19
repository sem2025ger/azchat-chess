import type { RootOptions } from 'react-dom/client';
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { safeEnvironment, safeRelease, sanitizeBreadcrumb, sanitizeEnvelope, sanitizeEvent, privateDataCollection } from './privacy.ts';

type Sdk = typeof import('./sdk.ts');
type InitOptions = NonNullable<Parameters<Sdk['init']>[0]>;
type Transport = ReturnType<NonNullable<InitOptions['transport']>>;
type Envelope = Parameters<Transport['send']>[0];
type Environment = {
  [name: string]: unknown;
  VITE_SENTRY_DSN?: string;
  VITE_SENTRY_ENVIRONMENT?: string;
  VITE_SENTRY_RELEASE_SHA?: string;
};

// No SDK import or init at all without a DSN. The entry point also avoids
// loading this module in that case, preserving the normal rendering path.
export async function initializeFrontendMonitoring(
  env: Environment,
  loadSdk: () => Promise<Sdk> = () => import('./sdk.ts'),
): Promise<RootOptions | undefined> {
  if (!env.VITE_SENTRY_DSN?.trim()) return undefined;
  try {
    const sdk = await loadSdk();
    const environment = safeEnvironment(env.VITE_SENTRY_ENVIRONMENT);
    const release = safeRelease(env.VITE_SENTRY_RELEASE_SHA);
    // Keep the requested legacy opt-out; native SDK 11 controls enforce it.
    const privacyOptions = { sendDefaultPii: false, dataCollection: privateDataCollection() };
    sdk.init({
      ...privacyOptions,
      dsn: env.VITE_SENTRY_DSN,
      environment,
      release,
      defaultIntegrations: false,
      // Explicit allowlist: no replay, feedback, breadcrumbs, session tracking,
      // console capture, network instrumentation or performance integrations.
      integrations: [sdk.globalHandlersIntegration(), sdk.dedupeIntegration()],
      tracesSampleRate: 0,
      traceLifecycle: 'static',
      tracePropagationTargets: [],
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      sendClientReports: false,
      beforeSend: (event) => {
        const safe = sanitizeEvent(event);
        return safe ? { ...safe, environment, ...(release ? { release } : {}) } as ErrorEvent : null;
      },
      beforeBreadcrumb: (crumb) => sanitizeBreadcrumb(crumb) as Breadcrumb | null,
      beforeSendTransaction: () => null,
      beforeSendLog: () => null,
      beforeSendMetric: () => null,
      transport: (options): Transport => {
        const transport = sdk.makeFetchTransport(options);
        return {
          send(envelope) {
            const safe = sanitizeEnvelope(envelope);
            return safe ? transport.send(safe as Envelope) : Promise.resolve({ statusCode: 200 });
          },
          flush: (timeout) => transport.flush(timeout),
        };
      },
    });
    const reportGlobal = (error: unknown) => {
      // Preserve React 19's default reporting instead of hiding console errors.
      if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
      else console.error(error);
    };
    function observeReactError(handled: boolean, report: (error: unknown, info: { componentStack?: string | null }) => void) {
      return (error: unknown, info: { componentStack?: string | null }) => {
        try {
          // No component props, component stack, user scope or custom metadata.
          sdk.captureException(error, { mechanism: { type: 'auto.function.react.error_handler', handled } });
        } catch { /* Always preserve React's local error reporting below. */ }
        report(error, info);
      };
    }
    return {
      onUncaughtError: observeReactError(false, reportGlobal),
      onCaughtError: observeReactError(true, (error, info) => console.error(error, info.componentStack)),
      onRecoverableError: observeReactError(true, reportGlobal),
    };
  } catch {
    // Monitoring must never prevent the application (or maintenance page)
    // from rendering, including when the optional SDK chunk cannot be loaded.
    return undefined;
  }
}
