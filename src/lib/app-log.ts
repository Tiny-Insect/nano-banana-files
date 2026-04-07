export function appLog(message: string) {
  try {
    (window as any).electronAPI?.log?.(message).catch?.(() => {});
  } catch {
    // ignore logging failures
  }
}

export function appLogError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  appLog(`[${scope}] ${message}`);
}
