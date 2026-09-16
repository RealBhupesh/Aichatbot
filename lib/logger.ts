type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
  "apikey",
  "api_key",
  "authorization",
  "token",
  "password",
  "secret",
  "llm_api_key",
  "ai_gateway_api_key",
]);

function sanitize(value: unknown, key?: string): unknown {
  if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
    return "[redacted]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 8).map((item) => sanitize(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitize(entryValue, entryKey),
      ]),
    );
  }

  if (typeof value === "string" && value.length > 180) {
    return `${value.slice(0, 180)}…`;
  }

  return value;
}

function write(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    at: new Date().toISOString(),
    ...(meta ? (sanitize(meta) as Record<string, unknown>) : {}),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(event: string, meta?: Record<string, unknown>) {
    write("info", event, meta);
  },
  warn(event: string, meta?: Record<string, unknown>) {
    write("warn", event, meta);
  },
  error(event: string, meta?: Record<string, unknown>) {
    write("error", event, meta);
  },
};
