export function reportLovableError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  (window as any).__lovableEvents?.captureException?.(
    error,
    {
      source: "react_error_boundary",
      route: window.location.pathname,
      ...context,
    },
    {
      mechanism: "react_error_boundary",
      handled: false,
      severity: "error",
    },
  );
  const stack = error instanceof Error ? error.stack : undefined;
  (window as any).__lovableReportRuntimeError?.({
    error,
    stack,
    context,
  });
}
