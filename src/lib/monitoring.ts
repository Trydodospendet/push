/**
 * Crash reporting with Sentry – switched off unless EXPO_PUBLIC_SENTRY_DSN is set.
 *
 * Without a DSN nothing is loaded and nothing leaves the phone. With one, only the technical
 * error report is sent: no e-mail address, no user id, no IP address, no breadcrumbs of screens
 * or network calls (they could contain places or amounts), no screenshots, no session replay.
 * The module is loaded on demand so a build without the DSN does not even start the SDK.
 */
type SentryModule = typeof import('@sentry/react-native');

let sentry: SentryModule | null = null;

export function isMonitoringEnabled(): boolean {
  return sentry !== null;
}

/** Starts Sentry if a DSN is configured. Never throws: monitoring must not break the app. */
export function initMonitoring(dsn: string | undefined = process.env.EXPO_PUBLIC_SENTRY_DSN): void {
  if (!dsn || sentry !== null) {
    return;
  }
  try {
    // Loaded only now, so a build without a DSN never starts the SDK.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require('@sentry/react-native') as SentryModule;
    module.init({
      dsn,
      sendDefaultPii: false,
      attachScreenshot: false,
      enableAutoSessionTracking: false,
      maxBreadcrumbs: 0,
      tracesSampleRate: 0,
      beforeSend(event) {
        // Whatever the SDK collected about the user is removed before sending.
        delete event.user;
        if (event.request) {
          delete event.request.headers;
          delete event.request.cookies;
          delete event.request.url;
        }
        return event;
      },
    });
    sentry = module;
  } catch {
    sentry = null;
  }
}

/** Reports an error that was caught by the app (no-op without a DSN). */
export function reportError(error: unknown): void {
  sentry?.captureException(error);
}
