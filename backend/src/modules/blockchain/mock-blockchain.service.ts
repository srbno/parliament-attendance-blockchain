import type { BlockchainService, OnChainAttendanceRecord, RegisterAttendanceProofInput } from './blockchain.service.js';
import { randomBytes } from 'node:crypto';

export class MockBlockchainService implements BlockchainService {
  private readonly records = new Map<string, { recordId: string; hash: string }>();

  async registerAttendanceProof(input: RegisterAttendanceProofInput) {
    const txHash = `0x${randomBytes(32).toString('hex')}`;
    this.records.set(txHash, { recordId: input.recordId, hash: input.evidenceHash });
    return { submitted: true, txHash, blockNumber: null };
  }

  async getSubmittedRecordFromTx(txHash: string): Promise<OnChainAttendanceRecord | null> {
    return this.records.get(txHash) ?? null;
  }
}
