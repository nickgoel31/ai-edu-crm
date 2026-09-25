import * as Sentry from "@sentry/nextjs";

// Only actually reports anything once SENTRY_DSN is set — this is a
// genuine no-op otherwise, not a stub. There was no error monitoring at
// all before this: uncaught exceptions only ever went to console.error,
// which nobody is watching in production.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
