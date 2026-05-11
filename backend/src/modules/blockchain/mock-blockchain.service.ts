import type { BlockchainService, RegisterAttendanceProofInput } from './blockchain.service.js';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger/logger.js';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { HashService } from "../evidence/hash.service.js";

const attendanceRegistryAbi = [
  'function addRecord(uint256 _id, bytes32 _hash) external',
  'function getTotalRecords() external view returns (uint256)'
] as const;

export class MockBlockchainService implements BlockchainService {
  constructor(
    private readonly provider = new JsonRpcProvider(env.BLOCKCHAIN_RPC_URL),
    private readonly signer = new Wallet(env.BLOCKCHAIN_PRIVATE_KEY, provider),
    private readonly hashService = new HashService()
  ) {}

  async registerAttendanceProof(input: RegisterAttendanceProofInput) {
    const contract = new Contract(env.ATTENDANCE_REGISTRY_ADDRESS, attendanceRegistryAbi, this.signer);

    logger.info('attendance_blockchain_submission_started', {
      recordId: input.recordId,
      contractAddress: env.ATTENDANCE_REGISTRY_ADDRESS,
      rpcUrl: env.BLOCKCHAIN_RPC_URL
    });

    const contentHash = this.hashService.hashCanonical({
      proof: input
    });
    const tx = await contract.addRecord(BigInt(input.recordId), contentHash);
    const receipt = await tx.wait();

    logger.info('attendance_blockchain_submission_confirmed', {
      recordId: input.recordId,
      txHash: receipt?.hash ?? tx.hash,
      blockNumber: receipt?.blockNumber ?? null
    });

    return {
      submitted: receipt?.status === 1,
      txHash: receipt?.hash ?? tx.hash,
      blockNumber: receipt?.blockNumber ?? null,
      ...(receipt?.status === 1 ? {} : { reason: 'Transaction was mined but reverted.' })
    };
  }
}
