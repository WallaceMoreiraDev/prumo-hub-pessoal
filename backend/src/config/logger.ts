export type LogLevel =
  | 'trace'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'fatal'
  | 'silent';

const LOG_LEVEL_WEIGHT: Readonly<Record<LogLevel, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
  silent: 100,
};

const SENSITIVE_KEY_FRAGMENTS = [
  'authorization',
  'token',
  'password',
  'apikey',
  'api_key',
  'cookie',
  'secret',
] as const;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment)
  );
}

function sanitizeValue(
  value: unknown,
  seen: WeakSet<object>,
  depth = 0
): unknown {
  if (depth > 8) {
    return '[MAX_DEPTH]';
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);
    return value.map((item) => sanitizeValue(item, seen, depth + 1));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    const sanitizedObject: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (isSensitiveKey(key)) {
        sanitizedObject[key] = '[REDACTED]';
      } else {
        sanitizedObject[key] = sanitizeValue(entryValue, seen, depth + 1);
      }
    }
    return sanitizedObject;
  }

  return String(value);
}

function sanitizeMetadata(
  meta?: Record<string, unknown>
): Record<string, unknown> {
  if (!meta) {
    return {};
  }

  const sanitized = sanitizeValue(meta, new WeakSet<object>());
  if (
    sanitized !== null &&
    typeof sanitized === 'object' &&
    !Array.isArray(sanitized)
  ) {
    return sanitized as Record<string, unknown>;
  }

  return {};
}

export interface EdgeLogger {
  trace(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(minLevel: LogLevel = 'info'): EdgeLogger {
  const minWeight = LOG_LEVEL_WEIGHT[minLevel];

  function emit(
    level: Exclude<LogLevel, 'silent'>,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    if (LOG_LEVEL_WEIGHT[level] < minWeight) {
      return;
    }

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...sanitizeMetadata(meta),
    });

    if (level === 'error' || level === 'fatal') {
      console.error(entry);
    } else if (level === 'warn') {
      console.warn(entry);
    } else {
      console.info(entry);
    }
  }

  return {
    trace: (message, meta) => emit('trace', message, meta),
    debug: (message, meta) => emit('debug', message, meta),
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta),
    fatal: (message, meta) => emit('fatal', message, meta),
  };
}

export const edgeLogger = createLogger('info');
