import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL = 'postgresql://attendance:attendance@localhost:5432/attendance';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.HASH_ALGORITHM = 'keccak256';
process.env.BLOCKCHAIN_MODE = 'mock';
process.env.EVIDENCE_HASH_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Fastify app plugin wiring', () => {
  it('exposes the JWT decorator on the app instance used by route services', async () => {
    const { buildApp } = await import('../../src/app.js');
    const app = await buildApp();

    try {
      expect(app.jwt).toBeDefined();
      expect(typeof app.jwt.sign).toBe('function');
    } finally {
      await app.close();
    }
  });
});
