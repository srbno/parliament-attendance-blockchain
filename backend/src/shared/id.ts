import { AppError } from './errors/app-error.js';

export function idToString(id: bigint | number | string | null | undefined): string | null {
  if (id === null || id === undefined) {
    return null;
  }
  return id.toString();
}

export function parseIntId(id: string): number {
  if (!/^\d+$/.test(id)) {
    throw new AppError('VALIDATION_FAILED', 'Invalid id.', 400, { id });
  }
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed) || parsed > 2_147_483_647) {
    throw new AppError('VALIDATION_FAILED', 'Invalid id.', 400, { id });
  }
  return parsed;
}
