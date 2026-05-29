import { env } from '../../config/env.js';
import { HashService } from './hash.service.js';
import type { CanonicalJsonValue } from './canonical-json.js';

export type EvidenceJsonValue =
  | string
  | number
  | boolean
  | null
  | EvidenceJsonValue[]
  | { [key: string]: EvidenceJsonValue | undefined };

export class EvidenceService {
  constructor(
    private readonly hashService = new HashService(),
    private readonly seed: string = env.EVIDENCE_HASH_SEED
  ) {}

  buildEvidencePayload(input: {
    recordId: string;
    deputyId: string;
    sessionId: string;
    registeredAt: string;
    validationPolicyId: string;
    validationResult: EvidenceJsonValue;
  }) {
    return {
      recordId: input.recordId,
      deputyId: input.deputyId,
      sessionId: input.sessionId,
      registeredAt: input.registeredAt,
      validationPolicyId: input.validationPolicyId,
      validationResult: input.validationResult,
      applicationId: env.APPLICATION_ID,
      applicationVersion: env.APPLICATION_VERSION,
      hashAlgorithm: this.hashService.algorithm,
      seed: this.seed
    };
  }

  hashEvidencePayload(payload: CanonicalJsonValue): string {
    return this.hashService.hashCanonical(payload);
  }
}
