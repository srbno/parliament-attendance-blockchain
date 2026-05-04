import { AppError } from './errors/app-error.js';

export function idToString(id: bigint | number | string | null | undefined): string | null {
  if (id === null || id === undefined) {
    return null;
  }
  return id.toString();
}

export function parseBigIntId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new AppError('VALIDATION_FAILED', 'Invalid id.', 400, { id });
  }
  return BigInt(id);
}
