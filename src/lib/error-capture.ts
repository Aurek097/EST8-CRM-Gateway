let lastError: Error | null = null;

export function captureError(error: Error) {
  lastError = error;
}

export function consumeLastCapturedError(): Error | null {
  const err = lastError;
  lastError = null;
  return err;
}
