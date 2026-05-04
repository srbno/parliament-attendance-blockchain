import { describe, expect, it } from 'vitest';
import { haversineDistanceMeters } from '../../src/shared/geo/haversine.js';
import { isIpInCidrRange, isIpInRanges } from '../../src/shared/network/cidr.js';
import { normalizeIpAddress } from '../../src/shared/network/ip.js';

describe('network and geo utilities', () => {
  it('matches IPv4 CIDR ranges and rejects addresses outside the range', () => {
    expect(isIpInCidrRange('192.168.1.45', '192.168.1.0/24')).toBe(true);
    expect(isIpInCidrRange('192.168.2.45', '192.168.1.0/24')).toBe(false);
    expect(isIpInRanges('127.0.0.1', ['10.0.0.0/8', '127.0.0.1/32'])).toBe(true);
  });

  it('normalizes IPv4-mapped local addresses', () => {
    expect(normalizeIpAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
    expect(normalizeIpAddress('127.0.0.1')).toBe('127.0.0.1');
  });

  it('computes Haversine distance in meters', () => {
    const distance = haversineDistanceMeters(
      { latitude: 38.7139, longitude: -9.1521 },
      { latitude: 38.7142, longitude: -9.1519 }
    );

    expect(distance).toBeGreaterThan(30);
    expect(distance).toBeLessThan(45);
  });
});
