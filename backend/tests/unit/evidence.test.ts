import { describe, expect, it } from 'vitest';
import { canonicalize } from '../../src/modules/evidence/canonical-json.js';
import { HashService } from '../../src/modules/evidence/hash.service.js';

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
