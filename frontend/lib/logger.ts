type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    metadata: metadata ?? {},
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}
