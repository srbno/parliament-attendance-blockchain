import { keccak_256 } from '@noble/hashes/sha3.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalize, type CanonicalJsonValue } from './canonical-json.js';
import { bytesToHex } from './hex.js';

export class HashService {
  readonly algorithm = 'keccak256';

  hashCanonical(value: CanonicalJsonValue): string {
    return this.hashString(canonicalize(value));
  }

  hashString(value: string): string {
    /**
     * keccak_256
     * This computes the cryptographic hash.
     *
     * Keccak-256 is:
     *
     * Ethereum’s native hash algorithm
     * close to SHA-3
     * deterministic
     * one-way
     * collision-resistant
     */
    return bytesToHex(keccak_256(utf8ToBytes(value)));
  }
}
