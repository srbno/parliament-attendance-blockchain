import type { BlockchainService, RegisterAttendanceProofInput } from './blockchain.service.js';
import { logger } from '../../shared/logger/logger.js';

export class MockBlockchainService implements BlockchainService {
  async registerAttendanceProof(_input: RegisterAttendanceProofInput) {
    logger.info('blockchain_mock_called');
    // Phase 2 will replace this class with an Ethereum adapter without changing attendance logic.
    return {
      submitted: false,
      txHash: null,
      blockNumber: null,
      reason: 'Blockchain integration not implemented yet'
    };
  }
}
