import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://attendance:attendance@localhost:5432/attendance';
process.env.JWT_SECRET ??= '12345678901234567890123456789012';
process.env.EVIDENCE_HASH_SEED ??= '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { canonicalize } = await import('../../src/modules/evidence/canonical-json.js');
const { HashService } = await import('../../src/modules/evidence/hash.service.js');
const { EvidenceService } = await import('../../src/modules/evidence/evidence.service.js');

const sampleEvidenceInput = {
  recordId: '1001',
  deputyId: '25',
  sessionId: '431',
  registeredAt: '2026-05-03T13:20:00.000Z',
  validationPolicyId: 'POLICY_V1',
  validationResult: {
    policy: 'POLICY_V1',
    policyVersion: 1,
    result: 'VALID' as const,
    checkedAt: '2026-05-03T13:20:00.000Z',
    checks: {}
  }
};

describe('evidence primitives', () => {
  it('canonicalizes objects with deterministic recursive key ordering', () => {
    const left = { z: 1, a: { d: 4, b: 2 }, c: [{ y: 'yes', x: 'ex' }] };
    const right = { c: [{ x: 'ex', y: 'yes' }], a: { b: 2, d: 4 }, z: 1 };

    expect(canonicalize(left)).toBe(canonicalize(right));
    expect(canonicalize(left)).toBe('{"a":{"b":2,"d":4},"c":[{"x":"ex","y":"yes"}],"z":1}');
  });

  it('produces the same keccak hash for semantically identical canonical payloads', () => {
    const hashService = new HashService();

    const hashA = hashService.hashCanonical({ b: 2, a: 1 });
    const hashB = hashService.hashCanonical({ a: 1, b: 2 });

    expect(hashA).toMatch(/^0x[0-9a-f]{64}$/);
    expect(hashA).toBe(hashB);
    expect(hashService.algorithm).toBe('keccak256');
  });
});

describe('EvidenceService seed', () => {
  it('mixes the configured seed into the canonical payload', () => {
    const seed = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const evidence = new EvidenceService(new HashService(), seed);

    const payload = evidence.buildEvidencePayload(sampleEvidenceInput);

    expect(payload.seed).toBe(seed);
  });

  it('produces a stable hash when the same input and seed are reused', () => {
    const seed = 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const evidence = new EvidenceService(new HashService(), seed);

    const first = evidence.hashEvidencePayload(evidence.buildEvidencePayload(sampleEvidenceInput));
    const second = evidence.hashEvidencePayload(evidence.buildEvidencePayload(sampleEvidenceInput));

    expect(first).toMatch(/^0x[0-9a-f]{64}$/);
    expect(first).toBe(second);
  });

  it('produces a different hash when the seed changes for the same input', () => {
    const evidenceA = new EvidenceService(
      new HashService(),
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    const evidenceB = new EvidenceService(
      new HashService(),
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );

    const hashA = evidenceA.hashEvidencePayload(evidenceA.buildEvidencePayload(sampleEvidenceInput));
    const hashB = evidenceB.hashEvidencePayload(evidenceB.buildEvidencePayload(sampleEvidenceInput));

    expect(hashA).not.toBe(hashB);
  });
});
