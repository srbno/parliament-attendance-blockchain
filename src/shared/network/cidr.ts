import { normalizeIpAddress } from './ip.js';

function ipv4ToInt(ip: string): number | null {
  const normalized = normalizeIpAddress(ip);
  const parts = normalized.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet < 0 || octet > 255) {
      return null;
    }
    result = (result << 8) + octet;
  }
  return result >>> 0;
}

export function isIpInCidrRange(ip: string, cidr: string): boolean {
  const [rangeIp, prefixText] = cidr.split('/');
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

export function isIpInRanges(ip: string, ranges: string[]): boolean {
  return ranges.some((range) => isIpInCidrRange(ip, range));
}
