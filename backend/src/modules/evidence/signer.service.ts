import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import * as secp from '@noble/secp256k1';
import { bytesToHex, hexToBytes } from './hex.js';

secp.hashes.sha256 = sha256;
secp.hashes.hmacSha256 = (key: Uint8Array, message: Uint8Array) => hmac(sha256, key, message);

export class SignerService {
  private readonly privateKeyBytes: Uint8Array;
  private readonly publicKeyBytes: Uint8Array;

  constructor(privateKey: string) {
    this.privateKeyBytes = hexToBytes(privateKey, 32);
    try {
      this.publicKeyBytes = secp.getPublicKey(this.privateKeyBytes, true);
    } catch {
      throw new Error('APP_PRIVATE_KEY must be a valid secp256k1 private key');
    }
  }

  signHash(hash: string): string {
    const hashBytes = hexToBytes(hash, 32);
    return bytesToHex(secp.sign(hashBytes, this.privateKeyBytes, { prehash: false, lowS: true }));
  }

  verifyHash(hash: string, signature: string): boolean {
    try {
      return secp.verify(hexToBytes(signature, 64), hexToBytes(hash, 32), this.publicKeyBytes, {
        prehash: false,
        lowS: true
      });
    } catch {
      return false;
    }
  }

  getPublicKey(): string {
    return bytesToHex(this.publicKeyBytes);
  }
}
