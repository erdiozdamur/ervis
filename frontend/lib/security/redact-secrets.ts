const REDACTED_VALUE = '[REDACTED]';

const SECRET_KEY_PATTERN = /(secret|password|token|api[_-]?key|authorization|credential|private[_-]?key|client[_-]?secret)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function shouldRedactKey(key: string) {
  return SECRET_KEY_PATTERN.test(key);
}

export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const redactedEntries = Object.entries(value).map(([key, nestedValue]) => {
    if (shouldRedactKey(key)) {
      return [key, REDACTED_VALUE];
    }

    return [key, redactSecrets(nestedValue)];
  });

  return Object.fromEntries(redactedEntries) as T;
}
