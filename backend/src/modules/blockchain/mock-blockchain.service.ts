import type { BlockchainService, RegisterAttendanceProofInput } from './blockchain.service.js';
import { logger } from '../../shared/logger/logger.js';
import { HashService } from '../evidence/hash.service.js';
import { ethers } from "ethers";
import { network } from "hardhat";

export class MockBlockchainService implements BlockchainService {
  constructor(private readonly hashService = new HashService()) {}

  async registerAttendanceProof(input: RegisterAttendanceProofInput) {





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
