export type RegisterAttendanceProofInput = {
  recordId: string;
  evidenceHash: string;
};

export interface BlockchainService {
  registerAttendanceProof(input: RegisterAttendanceProofInput): Promise<{
    submitted: boolean;
    txHash: string | null;
    blockNumber: number | null;
    reason?: string;
  }>;
}
