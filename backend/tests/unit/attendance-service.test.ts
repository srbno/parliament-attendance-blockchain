import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = 'postgresql://attendance:attendance@localhost:5432/attendance';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.APP_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MAX_GPS_ACCURACY_METERS = '100';
process.env.HASH_ALGORITHM = 'keccak256';
process.env.BLOCKCHAIN_MODE = 'mock';

const mocks = vi.hoisted(() => ({
  prisma: {
    user: { findUnique: vi.fn() },
    parliamentarySession: { findUnique: vi.fn() },
    validationPolicy: { findUnique: vi.fn() },
    attendanceRecord: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn()
    },
    auditLog: { create: vi.fn() }
  }
}));

vi.mock('../../src/db/prisma.js', () => ({ prisma: mocks.prisma }));

const { AttendanceService } = await import('../../src/modules/attendance/attendance.service.js');
const { EvidenceService } = await import('../../src/modules/evidence/evidence.service.js');
const { HashService } = await import('../../src/modules/evidence/hash.service.js');
const { SignerService } = await import('../../src/modules/evidence/signer.service.js');

const now = new Date('2026-05-03T13:20:00.000Z');
const tokenUser = { sub: '10', role: 'DEPUTY' as const, deputyId: '25' };
const submitInput = {
  sessionId: '431',
  gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 20 },
  clientRequestId: '550e8400-e29b-41d4-a716-446655440000'
};

function setupValidPrisma() {
  mocks.prisma.user.findUnique.mockResolvedValue({
    id: 10n,
    isActive: true,
    role: 'DEPUTY',
    deputyId: 25n,
    deputy: { id: 25n, active: true }
  });
  mocks.prisma.parliamentarySession.findUnique.mockResolvedValue({
    id: 431n,
    status: 'OPEN',
    checkinStart: new Date('2026-05-03T13:00:00.000Z'),
    checkinEnd: new Date('2026-05-03T14:00:00.000Z'),
    allowMultipleCheckins: false,
    location: {
      active: true,
      latitude: 38.7139,
      longitude: -9.1521,
      radiusMeters: 100,
      allowedIpRanges: ['127.0.0.1/32']
    }
  });
  mocks.prisma.validationPolicy.findUnique.mockResolvedValue({
    id: 'POLICY_V1',
    active: true,
    version: 1
  });
  mocks.prisma.attendanceRecord.findUnique.mockResolvedValue(null);
  mocks.prisma.attendanceRecord.count.mockResolvedValue(0);
  mocks.prisma.attendanceRecord.create.mockResolvedValue({
    id: 1001n,
    deputyId: 25n,
    sessionId: 431n,
    registeredAt: now
  });
  mocks.prisma.attendanceRecord.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1001n,
    deputyId: 25n,
    sessionId: 431n,
    registeredAt: now,
    validationPolicyId: 'POLICY_V1',
    validationResultHash: mocks.prisma.attendanceRecord.create.mock.calls[0][0].data.validationResultHash,
    evidenceHash: data.evidenceHash,
    signature: data.signature,
    txHash: null,
    blockNumber: null,
    contractAddress: null,
    status: data.status,
    failureReason: null,
    createdAt: now,
    updatedAt: now
  }));
  mocks.prisma.auditLog.create.mockResolvedValue({});
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  vi.clearAllMocks();
  setupValidPrisma();
});

describe('AttendanceService', () => {
  it('validates, hashes, signs, calls blockchain mock through the interface, and returns READY_FOR_CHAIN', async () => {
    const blockchain = { registerAttendanceProof: vi.fn().mockResolvedValue({ submitted: false, txHash: null, blockNumber: null, reason: 'Blockchain integration not implemented yet' }) };
    const service = new AttendanceService(blockchain);

    const response = await service.submit(submitInput, tokenUser, '127.0.0.1');

    expect(response.status).toBe('READY_FOR_CHAIN');
    expect(response.validationResultHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(response.evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(response.signature).toMatch(/^0x[0-9a-f]{128}$/);
    expect(blockchain.registerAttendanceProof).toHaveBeenCalledOnce();
    expect(mocks.prisma.attendanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'READY_FOR_CHAIN' })
      })
    );
  });

  it('rejects invalid policy results before evidence generation or blockchain submission', async () => {
    mocks.prisma.parliamentarySession.findUnique.mockResolvedValueOnce({
      id: 431n,
      status: 'OPEN',
      checkinStart: new Date('2026-05-03T13:00:00.000Z'),
      checkinEnd: new Date('2026-05-03T14:00:00.000Z'),
      allowMultipleCheckins: false,
      location: {
        active: true,
        latitude: 38.7139,
        longitude: -9.1521,
        radiusMeters: 100,
        allowedIpRanges: ['10.0.0.0/8']
      }
    });
    const blockchain = { registerAttendanceProof: vi.fn() };
    const service = new AttendanceService(blockchain);

    await expect(service.submit(submitInput, tokenUser, '127.0.0.1')).rejects.toMatchObject({
      code: 'IP_NOT_AUTHORIZED'
    });
    expect(mocks.prisma.attendanceRecord.create).not.toHaveBeenCalled();
    expect(blockchain.registerAttendanceProof).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: 'attendance_validation_rejected' }) })
    );
  });

  it('verifies local evidence and reports tampering', async () => {
    const evidence = new EvidenceService(
      new HashService(),
      new SignerService('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
    );
    const validationDetails = { policy: 'POLICY_V1', policyVersion: 1, result: 'VALID', checkedAt: now.toISOString(), checks: {} };
    const validationResultHash = evidence.hashValidationResult(validationDetails);
    const evidencePayload = evidence.buildEvidencePayload({
      recordId: '1001',
      deputyId: '25',
      sessionId: '431',
      registeredAt: now.toISOString(),
      validationPolicyId: 'POLICY_V1',
      validationResultHash
    });
    const evidenceHash = evidence.hashEvidencePayload(evidencePayload);
    const signature = evidence.signEvidenceHash(evidenceHash);
    mocks.prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue({
      id: 1001n,
      status: 'READY_FOR_CHAIN',
      validationDetailsJson: validationDetails,
      validationResultHash,
      evidencePayloadJson: { tampered: true },
      evidenceHash,
      signature
    });

    const result = await new AttendanceService().verify('1001');

    expect(result.validationResultHashMatches).toBe(true);
    expect(result.evidenceHashMatches).toBe(false);
    expect(result.signatureValid).toBe(true);
    expect(result.overallResult).toBe('LOCAL_VERIFICATION_FAILED');
  });
});
