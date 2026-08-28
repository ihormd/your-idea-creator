// Central place to report unexpected runtime errors (React error boundaries,
// SSR failures). Currently logs to the console; swap the body for a real
// provider (Sentry, etc.) when you wire one up.
export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error);
  console.error("[error]", message, { route: window.location.pathname, ...context }, error);
}
