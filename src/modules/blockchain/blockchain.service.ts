export type RegisterAttendanceProofInput = {
  recordId: string;
  deputyId: string;
  sessionId: string;
  registeredAt: string;
  validationPolicyId: string;
  validationResultHash: string;
  evidenceHash: string;
  signature: string;
};

export interface BlockchainService {
  registerAttendanceProof(input: RegisterAttendanceProofInput): Promise<{
    submitted: boolean;
    txHash: string | null;
    blockNumber: number | null;
    reason?: string;
  }>;
}
