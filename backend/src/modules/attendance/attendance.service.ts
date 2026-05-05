import { env } from '../../config/env.js';
import { prisma } from '../../db/prisma.js';
import { EvidenceService } from '../evidence/evidence.service.js';
import { MockBlockchainService } from '../blockchain/mock-blockchain.service.js';
import type { BlockchainService } from '../blockchain/blockchain.service.js';
import { runPolicyV1 } from '../validation/policies/policy-v1.js';
import type { PolicyV1Result } from '../validation/validation-engine.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idToString, parseBigIntId } from '../../shared/id.js';
import { normalizeIpAddress } from '../../shared/network/ip.js';
import { logger } from '../../shared/logger/logger.js';
import type { JwtUser } from '../auth/auth.types.js';
import type { SubmitAttendanceInput } from './attendance.schemas.js';

const activeAttendanceStatuses = ['PENDING', 'VALIDATED', 'HASHED', 'SIGNED', 'READY_FOR_CHAIN', 'SUBMITTED', 'CONFIRMED'];

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
  id: bigint;
  deputyId: bigint;
  sessionId: bigint;
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
    private readonly blockchainService: BlockchainService = new MockBlockchainService(),
    private readonly evidenceService = new EvidenceService()
  ) {}

  async submit(input: SubmitAttendanceInput, tokenUser: JwtUser, requestIp: string) {
    const now = new Date();
    const clientIp = normalizeIpAddress(requestIp);
    const sessionId = parseBigIntId(input.sessionId);
    logger.info('attendance_validation_started', { userId: tokenUser.sub, sessionId: input.sessionId, clientRequestId: input.clientRequestId });

    const [user, session, validationPolicy, requestIdRecord] = await Promise.all([
      prisma.user.findUnique({ where: { id: BigInt(tokenUser.sub) }, include: { deputy: true } }),
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

    const validationResult = runPolicyV1({
      user: user
        ? { id: user.id.toString(), isActive: user.isActive, role: user.role, deputyId: idToString(user.deputyId) }
        : null,
      deputy: user?.deputy ? { id: user.deputy.id.toString(), active: user.deputy.active } : null,
      session: session
        ? {
            id: session.id.toString(),
            status: session.status,
            checkinStart: session.checkinStart,
            checkinEnd: session.checkinEnd,
            allowMultipleCheckins: session.allowMultipleCheckins
          }
        : null,
      location: session?.location
        ? {
            latitude: session.location.latitude,
            longitude: session.location.longitude,
            radiusMeters: session.location.radiusMeters,
            allowedIpRanges: jsonArrayToStrings(session.location.allowedIpRanges),
            active: session.location.active
          }
        : null,
      gps: input.gps,
      clientIp,
      clientRequestId: input.clientRequestId,
      now,
      maxGpsAccuracyMeters: env.MAX_GPS_ACCURACY_METERS,
      duplicateAttendanceExists: Boolean(duplicateAttendanceExists),
      clientRequestIdAlreadyUsed: Boolean(requestIdRecord)
    });

    if (validationResult.result === 'INVALID') {
      const errorCode = validationResult.errorCode ?? 'VALIDATION_FAILED';
      await prisma.auditLog.create({
        data: {
          eventType: 'attendance_validation_rejected',
          actorUserId: BigInt(tokenUser.sub),
          detailsJson: { clientRequestId: input.clientRequestId, sessionId: input.sessionId, validationResult }
        }
      });
      logger.warn('attendance_validation_rejected', { userId: tokenUser.sub, errorCode, clientRequestId: input.clientRequestId });
      throw new AppError(errorCode, validationMessages[errorCode] ?? 'Attendance validation failed.', errorCode === 'UNAUTHORIZED' ? 401 : 400, validationDetailsForError(validationResult));
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        deputyId: user!.deputyId!,
        sessionId: session!.id,
        registeredAt: now,
        clientRequestId: input.clientRequestId,
        clientIp,
        gpsLatitude: input.gps.latitude,
        gpsLongitude: input.gps.longitude,
        gpsAccuracyMeters: input.gps.accuracyMeters,
        validationPolicyId: validationPolicy.id,
        validationDetailsJson: validationResult,
        status: 'PENDING'
      }
    });

    const evidencePayload = this.evidenceService.buildEvidencePayload({
      recordId: record.id.toString(),
      deputyId: record.deputyId.toString(),
      sessionId: record.sessionId.toString(),
      registeredAt: record.registeredAt.toISOString(),
      validationPolicyId: validationPolicy.id,
      validationResult
    });
    const evidenceHash = this.evidenceService.hashEvidencePayload(evidencePayload);
    const signature = this.evidenceService.signEvidenceHash(evidenceHash);
    logger.info('attendance_evidence_generated', { recordId: record.id.toString(), clientRequestId: input.clientRequestId });
    logger.info('attendance_signed', { recordId: record.id.toString() });

    const blockchain = await this.blockchainService.registerAttendanceProof({
      recordId: record.id.toString(),
      deputyId: record.deputyId.toString(),
      sessionId: record.sessionId.toString(),
      registeredAt: record.registeredAt.toISOString(),
      validationPolicyId: validationPolicy.id,
      evidenceHash,
      signature
    });

    const updated = await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        evidencePayloadJson: evidencePayload,
        evidenceHash,
        signature,
        txHash: blockchain.txHash,
        blockNumber: blockchain.blockNumber === null ? null : BigInt(blockchain.blockNumber),
        status: 'READY_FOR_CHAIN'
      }
    });

    await prisma.auditLog.create({
      data: {
        eventType: 'attendance_ready_for_chain',
        actorUserId: user!.id,
        attendanceRecordId: updated.id,
        detailsJson: { clientRequestId: input.clientRequestId, blockchain }
      }
    });
    logger.info('attendance_ready_for_chain', { recordId: updated.id.toString(), clientRequestId: input.clientRequestId });

    return {
      recordId: updated.id.toString(),
      status: updated.status,
      deputyId: updated.deputyId.toString(),
      sessionId: updated.sessionId.toString(),
      registeredAt: updated.registeredAt.toISOString(),
      validationPolicyId: updated.validationPolicyId,
      evidenceHash: updated.evidenceHash,
      signature: updated.signature,
      blockchain
    };
  }

  async get(id: string) {
    return serializeAttendance(await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: parseBigIntId(id) } }));
  }

  async listBySession(sessionId: string) {
    return (
      await prisma.attendanceRecord.findMany({ where: { sessionId: parseBigIntId(sessionId) }, orderBy: { id: 'asc' } })
    ).map(serializeAttendance);
  }

  async listByDeputy(deputyId: string) {
    return (
      await prisma.attendanceRecord.findMany({ where: { deputyId: parseBigIntId(deputyId) }, orderBy: { id: 'asc' } })
    ).map(serializeAttendance);
  }

  async verify(id: string) {
    const record = await prisma.attendanceRecord.findUniqueOrThrow({ where: { id: parseBigIntId(id) } });
    logger.info('attendance_verify_requested', { recordId: record.id.toString() });

    const recalculatedEvidenceHash = record.evidencePayloadJson
      ? this.evidenceService.hashEvidencePayload(record.evidencePayloadJson as never)
      : null;
    const evidenceHashMatches = Boolean(record.evidenceHash) && recalculatedEvidenceHash === record.evidenceHash;
    const signatureValid =
      Boolean(record.evidenceHash && record.signature) &&
      this.evidenceService.verifySignature(record.evidenceHash!, record.signature!);
    const databaseHashMatches = evidenceHashMatches;
    const locallyValid = databaseHashMatches && signatureValid && record.status === 'READY_FOR_CHAIN';

    return {
      recordId: record.id.toString(),
      databaseStatus: record.status,
      databaseHashMatches,
      evidenceHashMatches,
      signatureValid,
      blockchainRecordFound: false,
      blockchainCheckAvailable: false,
      overallResult: locallyValid ? 'LOCALLY_VALID_READY_FOR_CHAIN' : 'LOCAL_VERIFICATION_FAILED'
    };
  }
}
