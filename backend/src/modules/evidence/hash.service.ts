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
    return bytesToHex(keccak_256(utf8ToBytes(value)));
  }
}
