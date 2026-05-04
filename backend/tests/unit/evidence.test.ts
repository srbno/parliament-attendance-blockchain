import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../src/modules/evidence/canonical-json.js';
import { HashService } from '../../src/modules/evidence/hash.service.js';
import { SignerService } from '../../src/modules/evidence/signer.service.js';

const privateKey = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

  it('signs an evidence hash and verifies it with the configured application key', () => {
    const signer = new SignerService(privateKey);
    const hash = new HashService().hashCanonical({ recordId: '1001', status: 'READY_FOR_CHAIN' });

    const signature = signer.signHash(hash);

    expect(signature).toMatch(/^0x[0-9a-f]{128}$/);
    expect(signer.verifyHash(hash, signature)).toBe(true);
    expect(signer.verifyHash(new HashService().hashCanonical({ recordId: '1002' }), signature)).toBe(false);
  });
});
