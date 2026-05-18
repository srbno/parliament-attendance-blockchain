import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import type { AttendanceRecord, Prisma } from '../../generated/prisma/client.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { HardhatBlockchainService } from '../blockchain/hardhat-blockchain.service';
import type { BlockchainService } from '../blockchain/blockchain.service.js';
import { runPolicyV1 } from '../validation/policies/policy-v1.js';
import type { PolicyV1Result } from '../validation/validation-engine.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idToString, parseIntId } from '../../shared/id.js';
import { normalizeIpAddress } from '../../shared/network/ip.js';
import { logger } from '../../shared/logger/logger.js';
import type { JwtUser } from '../auth/auth.types.js';
import type { SubmitAttendanceInput } from './attendance.schemas.js';

const activeAttendanceStatuses = ['PENDING', 'VALIDATED', 'HASHED', 'SIGNED', 'READY_FOR_CHAIN', 'SUBMITTED', 'CONFIRMED'];

type AttendanceUserWithDeputy = Prisma.UserGetPayload<{ include: { deputy: true } }>;
type ParliamentarySessionWithLocation = Prisma.ParliamentarySessionGetPayload<{ include: { location: true } }>;
type ValidationPolicyRecord = Prisma.ValidationPolicyGetPayload<Record<string, never>>;
type BlockchainSubmissionResult = Awaited<ReturnType<BlockchainService['registerAttendanceProof']>>;
type CreatedAttendanceRecord = Pick<AttendanceRecord, 'id' | 'deputyId' | 'sessionId' | 'registeredAt'>;
type SubmittedAttendanceRecord = Pick<
  AttendanceRecord,
  'id' | 'deputyId' | 'sessionId' | 'registeredAt' | 'validationPolicyId' | 'evidenceHash' | 'signature' | 'status'
>;
type SignedAttendanceEvidence = {
  evidencePayload: ReturnType<EvidenceService['buildEvidencePayload']>;
  evidenceHash: string;
  signature: string;
};
type DataRequiredToValidateAttendance = {
  now: Date;
  clientIp: string;
  sessionId: number;
  user: AttendanceUserWithDeputy | null;
  session: ParliamentarySessionWithLocation | null;
  validationPolicy: ValidationPolicyRecord;
  duplicateAttendanceExists: boolean;
  clientRequestIdAlreadyUsed: boolean;
};

const validationMessages: Record<string, string> = {
  UNAUTHORIZED: 'Authentication is required.',
  USER_NOT_LINKED_TO_DEPUTY: 'The authenticated user is not linked to an active deputy.',
  DEPUTY_INACTIVE: 'The linked deputy is inactive.',
  SESSION_NOT_FOUND: 'The parliamentary session was not found.',
  SESSION_NOT_OPEN: 'The parliamentary session is not open for attendance.',
  CHECKIN_WINDOW_CLOSED: 'The check-in window is closed.',
  DUPLICATE_ATTENDANCE: 'Attendance has already been registered for this session.',
  CLIENT_REQUEST_ID_ALREADY_USED: 'The clientRequestId has already been used.',
  IP_NOT_AUTHORIZED: 'The request IP is not authorized for this session location.',
  GPS_OUT_OF_RANGE: 'The reported location is outside the authorized radius for this session.',
  GPS_ACCURACY_TOO_LOW: 'The reported GPS accuracy is above the accepted threshold.'
};

function jsonArrayToStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function validationDetailsForError(result: PolicyV1Result): Record<string, unknown> {
  const failed = Object.entries(result.checks).find(([, check]) => check.status === 'invalid');
  return failed ? { check: failed[0], ...failed[1] } : {};
}

function serializeAttendance(record: {
  id: number;
  deputyId: number;
  sessionId: number;
  registeredAt: Date;
  validationPolicyId: string;
  validationDetailsJson: unknown;
  evidencePayloadJson: unknown;
  evidenceHash: string | null;
  signature: string | null;
  txHash: string | null;
  blockNumber: bigint | null;
  contractAddress: string | null;
  status: string;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    recordId: record.id.toString(),
    deputyId: record.deputyId.toString(),
    sessionId: record.sessionId.toString(),
    registeredAt: record.registeredAt.toISOString(),
    validationPolicyId: record.validationPolicyId,
    validationDetails: record.validationDetailsJson,
    evidencePayload: record.evidencePayloadJson,
    evidenceHash: record.evidenceHash,
    signature: record.signature,
    txHash: record.txHash,
    blockNumber: idToString(record.blockNumber),
    contractAddress: record.contractAddress,
    status: record.status,
    failureReason: record.failureReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

export class AttendanceService {
  constructor(
    private readonly blockchainService: BlockchainService = new HardhatBlockchainService(),
    private readonly evidenceService = new EvidenceService()
  ) {}

  async submit(input: SubmitAttendanceInput, tokenUser: JwtUser, requestIp: string) {
    const dataRequiredToValidateAttendance = await this.getDataRequiredToValidateAttendance(input, tokenUser, requestIp);
    const validationResult = this.validateAttendanceSubmission(input, dataRequiredToValidateAttendance);

    await this.rejectInvalidAttendanceSubmission(validationResult, input, tokenUser);

    const pendingRecord = await this.createPendingAttendanceRecord(
      input,
      dataRequiredToValidateAttendance,
      validationResult
    );
    const signedEvidence = this.createSignedAttendanceEvidence(
      pendingRecord,
      dataRequiredToValidateAttendance.validationPolicy.id,
      validationResult
    );
    const blockchainSubmission = await this.submitAttendanceProofToBlockchain(pendingRecord, signedEvidence);
    const submittedRecord = await this.markAttendanceProofSubmitted(
      pendingRecord.id,
      signedEvidence,
      blockchainSubmission
    );

    await this.auditAttendanceProofSubmitted(
      submittedRecord,
      input,
      dataRequiredToValidateAttendance.user,
      blockchainSubmission
    );

    return this.toSubmitAttendanceResponse(submittedRecord, blockchainSubmission);
  }

  async get(id: string) {
    return serializeAttendance(await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: parseIntId(id) } }));
  }

  async listBySession(sessionId: string) {
    return (
      await prisma.attendanceRecord.findMany({ where: { sessionId: parseIntId(sessionId) }, orderBy: { id: 'asc' } })
    ).map(serializeAttendance);
  }

  async listByDeputy(deputyId: string) {
    return (
      await prisma.attendanceRecord.findMany({ where: { deputyId: parseIntId(deputyId) }, orderBy: { id: 'asc' } })
    ).map(serializeAttendance);
  }

  async verify(id: string) {
    const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: parseIntId(id) } });
    logger.info('attendance_verify_requested', { recordId: record.id.toString() });

    const recalculatedEvidenceHash = record.evidencePayloadJson
      ? this.evidenceService.hashEvidencePayload(record.evidencePayloadJson as never)
      : null;
    const evidenceHashMatches = Boolean(record.evidenceHash) && recalculatedEvidenceHash === record.evidenceHash;
    const signatureValid =
      Boolean(record.evidenceHash && record.signature) &&
      this.evidenceService.verifySignature(record.evidenceHash!, record.signature!);
    const databaseHashMatches = evidenceHashMatches;
    const locallyValid = databaseHashMatches && signatureValid && record.status === 'SUBMITTED';

    return {
      recordId: record.id.toString(),
      databaseStatus: record.status,
      databaseHashMatches,
      evidenceHashMatches,
      signatureValid,
      blockchainRecordFound: false,
      blockchainCheckAvailable: false,
      overallResult: locallyValid ? 'LOCALLY_VALID_SUBMITTED' : 'LOCAL_VERIFICATION_FAILED'
    };
  }

  private async getDataRequiredToValidateAttendance(
    input: SubmitAttendanceInput,
    tokenUser: JwtUser,
    requestIp: string
  ): Promise<DataRequiredToValidateAttendance> {
    const now = new Date();
    const clientIp = normalizeIpAddress(requestIp);
    const sessionId = parseIntId(input.sessionId);
    logger.info('attendance_validation_started', { userId: tokenUser.sub, sessionId: input.sessionId, clientRequestId: input.clientRequestId });

    const [user, session, validationPolicy, requestIdRecord] = await Promise.all([
      prisma.user.findUnique({ where: { id: parseIntId(tokenUser.sub) }, include: { deputy: true } }),
      prisma.parliamentarySession.findUnique({ where: { id: sessionId }, include: { location: true } }),
      prisma.validationPolicy.findUnique({ where: { id: 'POLICY_V1' } }),
      prisma.attendanceRecord.findUnique({ where: { clientRequestId: input.clientRequestId } })
    ]);

    if (!validationPolicy?.active) {
      throw new AppError('VALIDATION_FAILED', 'Active validation policy POLICY_V1 is not configured.', 500);
    }

    const deputyId = user?.deputyId ?? null;
    const duplicateAttendanceExists =
      deputyId && session
        ? (await prisma.attendanceRecord.count({
            where: {
              deputyId,
              sessionId: session.id,
              status: { in: activeAttendanceStatuses as never }
            }
          })) > 0
        : false;

    return {
      now,
      clientIp,
      sessionId,
      user,
      session,
      validationPolicy,
      duplicateAttendanceExists: Boolean(duplicateAttendanceExists),
      clientRequestIdAlreadyUsed: Boolean(requestIdRecord)
    };
  }

  private validateAttendanceSubmission(
    input: SubmitAttendanceInput,
    data: DataRequiredToValidateAttendance
  ): PolicyV1Result {
    return runPolicyV1({
      user: data.user
        ? {
            id: data.user.id.toString(),
            isActive: data.user.isActive,
            role: data.user.role,
            deputyId: idToString(data.user.deputyId)
          }
        : null,
      deputy: data.user?.deputy ? { id: data.user.deputy.id.toString(), active: data.user.deputy.active } : null,
      session: data.session
        ? {
            id: data.session.id.toString(),
            status: data.session.status,
            checkinStart: data.session.checkinStart,
            checkinEnd: data.session.checkinEnd,
            allowMultipleCheckins: data.session.allowMultipleCheckins
          }
        : null,
      location: data.session?.location
        ? {
            latitude: data.session.location.latitude,
            longitude: data.session.location.longitude,
            radiusMeters: data.session.location.radiusMeters,
            allowedIpRanges: jsonArrayToStrings(data.session.location.allowedIpRanges),
            active: data.session.location.active
          }
        : null,
      gps: input.gps,
      clientIp: data.clientIp,
      clientRequestId: input.clientRequestId,
      now: data.now,
      maxGpsAccuracyMeters: env.MAX_GPS_ACCURACY_METERS,
      duplicateAttendanceExists: data.duplicateAttendanceExists,
      clientRequestIdAlreadyUsed: data.clientRequestIdAlreadyUsed
    });
  }

  private async rejectInvalidAttendanceSubmission(
    validationResult: PolicyV1Result,
    input: SubmitAttendanceInput,
    tokenUser: JwtUser
  ) {
    if (validationResult.result === 'INVALID') {
      const errorCode = validationResult.errorCode ?? 'VALIDATION_FAILED';
      await prisma.auditLog.create({
        data: {
          eventType: 'attendance_validation_rejected',
          actorUserId: parseIntId(tokenUser.sub),
          detailsJson: { clientRequestId: input.clientRequestId, sessionId: input.sessionId, validationResult }
        }
      });
      logger.warn('attendance_validation_rejected', { userId: tokenUser.sub, errorCode, clientRequestId: input.clientRequestId });
      throw new AppError(errorCode, validationMessages[errorCode] ?? 'Attendance validation failed.', errorCode === 'UNAUTHORIZED' ? 401 : 400, validationDetailsForError(validationResult));
    }
  }

  private async createPendingAttendanceRecord(
    input: SubmitAttendanceInput,
    data: DataRequiredToValidateAttendance,
    validationResult: PolicyV1Result
  ): Promise<CreatedAttendanceRecord> {
    const deputyId = data.user?.deputyId;
    const session = data.session;

    if (!deputyId || !session) {
      throw new AppError('VALIDATION_FAILED', 'Attendance validation passed without required persistence data.', 500);
    }

    return prisma.attendanceRecord.create({
      data: {
        deputyId,
        sessionId: session.id,
        registeredAt: data.now,
        clientRequestId: input.clientRequestId,
        clientIp: data.clientIp,
        gpsLatitude: input.gps.latitude,
        gpsLongitude: input.gps.longitude,
        gpsAccuracyMeters: input.gps.accuracyMeters,
        validationPolicyId: data.validationPolicy.id,
        validationDetailsJson: validationResult,
        status: 'PENDING'
      }
    });
  }

  private createSignedAttendanceEvidence(
    record: CreatedAttendanceRecord,
    validationPolicyId: string,
    validationResult: PolicyV1Result
  ): SignedAttendanceEvidence {
    const evidencePayload = this.evidenceService.buildEvidencePayload({
      recordId: record.id.toString(),
      deputyId: record.deputyId.toString(),
      sessionId: record.sessionId.toString(),
      registeredAt: record.registeredAt.toISOString(),
      validationPolicyId,
      validationResult
    });
    const evidenceHash = this.evidenceService.hashEvidencePayload(evidencePayload);
    const signature = this.evidenceService.signEvidenceHash(evidenceHash);
    logger.info('attendance_evidence_generated', { recordId: record.id.toString() });
    logger.info('attendance_signed', { recordId: record.id.toString() });

    return { evidencePayload, evidenceHash, signature };
  }

  private async submitAttendanceProofToBlockchain(
    record: CreatedAttendanceRecord,
    signedEvidence: SignedAttendanceEvidence
  ): Promise<BlockchainSubmissionResult> {
    return this.blockchainService.registerAttendanceProof({
      recordId: record.id.toString(),
      evidenceHash: signedEvidence.evidenceHash
    });
  }

  private async markAttendanceProofSubmitted(
    recordId: number,
    signedEvidence: SignedAttendanceEvidence,
    blockchainSubmission: BlockchainSubmissionResult
  ): Promise<SubmittedAttendanceRecord> {
    return prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        evidencePayloadJson: signedEvidence.evidencePayload,
        evidenceHash: signedEvidence.evidenceHash,
        signature: signedEvidence.signature,
        txHash: blockchainSubmission.txHash,
        blockNumber: blockchainSubmission.blockNumber === null ? null : BigInt(blockchainSubmission.blockNumber),
        status: 'SUBMITTED'
      }
    });
  }

  private async auditAttendanceProofSubmitted(
    record: SubmittedAttendanceRecord,
    input: SubmitAttendanceInput,
    user: AttendanceUserWithDeputy | null,
    blockchainSubmission: BlockchainSubmissionResult
  ) {
    await prisma.auditLog.create({
      data: {
        eventType: 'attendance_proof_submitted',
        actorUserId: user?.id ?? null,
        attendanceRecordId: record.id,
        detailsJson: { clientRequestId: input.clientRequestId, blockchain: blockchainSubmission }
      }
    });
    logger.info('attendance_proof_submitted', { recordId: record.id.toString(), clientRequestId: input.clientRequestId });
  }

  private toSubmitAttendanceResponse(record: SubmittedAttendanceRecord, blockchain: BlockchainSubmissionResult) {
    return {
      recordId: record.id.toString(),
      status: record.status,
      deputyId: record.deputyId.toString(),
      sessionId: record.sessionId.toString(),
      registeredAt: record.registeredAt.toISOString(),
      validationPolicyId: record.validationPolicyId,
      evidenceHash: record.evidenceHash,
      signature: record.signature,
      blockchain
    };
  }
}
