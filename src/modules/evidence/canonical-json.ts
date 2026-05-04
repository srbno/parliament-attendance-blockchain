export type CanonicalJsonValue =
  | string
  | number
  | boolean
  | null
  | Date
  | bigint
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue | undefined };

function normalize(value: CanonicalJsonValue | undefined): unknown {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Canonical JSON does not support non-finite numbers');
    }
    return Number.isInteger(value) ? value : Number(value.toFixed(6));
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }

  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = normalize(value[key]);
    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }
  return result;
}

export function canonicalize(value: CanonicalJsonValue): string {
  return JSON.stringify(normalize(value));
}

export function toCanonicalValue(value: CanonicalJsonValue): unknown {
  return normalize(value);
}
