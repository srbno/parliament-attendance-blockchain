type LogFields = Record<string, unknown>;

function redact(fields: LogFields): LogFields {
  const blocked = new Set(['password', 'passwordHash', 'authorization', 'token', 'jwt', 'APP_PRIVATE_KEY']);
  return Object.fromEntries(
    Object.entries(fields).filter(([key]) => !blocked.has(key) && !key.toLowerCase().includes('authorization'))
  );
}

export const logger = {
  info(event: string, fields: LogFields = {}) {
    console.info(JSON.stringify({ level: 'info', event, ...redact(fields) }));
  },
  warn(event: string, fields: LogFields = {}) {
    console.warn(JSON.stringify({ level: 'warn', event, ...redact(fields) }));
  },
  error(event: string, fields: LogFields = {}) {
    console.error(JSON.stringify({ level: 'error', event, ...redact(fields) }));
  }
};
