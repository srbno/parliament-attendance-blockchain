import type { BlockchainService, RegisterAttendanceProofInput } from './blockchain.service.js';
import { logger } from '../../shared/logger/logger.js';
import { HashService } from '../evidence/hash.service.js';

export class MockBlockchainService implements BlockchainService {
  constructor(private readonly hashService = new HashService()) {}

  async registerAttendanceProof(input: RegisterAttendanceProofInput) {
    logger.info('blockchain_mock_called');
    return {
      submitted: true,
      txHash: this.hashService.hashCanonical({
        type: 'mock_blockchain_transaction',
        proof: input
      }),
      blockNumber: null
    };
  }
}
