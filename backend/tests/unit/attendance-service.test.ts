import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATABASE_URL = 'postgresql://attendance:attendance@localhost:5432/attendance';
process.env.JWT_SECRET = '12345678901234567890123456789012';
process.env.MAX_GPS_ACCURACY_METERS = '100';
process.env.HASH_ALGORITHM = 'keccak256';
process.env.BLOCKCHAIN_MODE = 'mock';
process.env.EVIDENCE_HASH_SEED = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

const now = new Date('2026-05-03T13:20:00.000Z');
const tokenUser = { sub: '10', role: 'DEPUTY' as const, deputyId: '25' };
const submitInput = {
  sessionId: '431',
  gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 20 },
  clientRequestId: '550e8400-e29b-41d4-a716-446655440000'
};

function setupValidPrisma() {
  mocks.prisma.user.findUnique.mockResolvedValue({
    id: 10,
    isActive: true,
    role: 'DEPUTY',
    deputyId: 25,
    deputy: { id: 25, active: true }
  });
  mocks.prisma.parliamentarySession.findUnique.mockResolvedValue({
    id: 431,
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
    id: 1001,
    deputyId: 25,
    sessionId: 431,
    registeredAt: now,
    applicationId: 'attendance-backend',
    applicationVersion: '1.0.0',
    hashAlgorithm: 'keccak256'
  });
  mocks.prisma.attendanceRecord.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 1001,
    deputyId: 25,
    sessionId: 431,
    registeredAt: now,
    validationPolicyId: 'POLICY_V1',
    txHash: data.txHash,
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
  it('validates, hashes evidence, submits the proof to blockchain, and returns SUBMITTED', async () => {
    const blockchain = {
      registerAttendanceProof: vi.fn().mockResolvedValue({
        submitted: true,
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        blockNumber: null
      }),
      getOnChainHashForTx: vi.fn().mockResolvedValue(null)
    };
    const service = new AttendanceService(blockchain);

    const response = await service.submit(submitInput, tokenUser, '127.0.0.1');

    expect(response.status).toBe('SUBMITTED');
    expect(mocks.prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 10 }, include: { deputy: true } });
    expect(mocks.prisma.parliamentarySession.findUnique).toHaveBeenCalledWith({
      where: { id: 431 },
      include: { location: true }
    });
    expect(response).not.toHaveProperty('validationResultHash');
    expect(response).not.toHaveProperty('signature');
    expect(response).not.toHaveProperty('evidenceHash');
    expect(blockchain.registerAttendanceProof).toHaveBeenCalledOnce();
    expect(blockchain.registerAttendanceProof).toHaveBeenCalledWith({
      recordId: '1001',
      evidenceHash: expect.stringMatching(/^0x[0-9a-f]{64}$/)
    });
    expect(mocks.prisma.attendanceRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SUBMITTED',
          txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        })
      })
    );
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorUserId: 10, eventType: 'attendance_proof_submitted' })
      })
    );
    expect(mocks.prisma.attendanceRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ validationResultHash: expect.anything() })
      })
    );
  });

  it('rejects invalid policy results before evidence generation or blockchain submission', async () => {
    mocks.prisma.parliamentarySession.findUnique.mockResolvedValueOnce({
      id: 431,
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
    const blockchain = { registerAttendanceProof: vi.fn(), getOnChainHashForTx: vi.fn() };
    const service = new AttendanceService(blockchain);

    await expect(service.submit(submitInput, tokenUser, '127.0.0.1')).rejects.toMatchObject({
      code: 'IP_NOT_AUTHORIZED'
    });
    expect(mocks.prisma.attendanceRecord.create).not.toHaveBeenCalled();
    expect(blockchain.registerAttendanceProof).not.toHaveBeenCalled();
    expect(mocks.prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorUserId: 10, eventType: 'attendance_validation_rejected' }) })
    );
  });

  it('reports CHAIN_VALID when recalculated hash matches on-chain hash', async () => {
    const evidence = new EvidenceService(new HashService());
    const validationDetails = { policy: 'POLICY_V1', policyVersion: 1, result: 'VALID', checkedAt: now.toISOString(), checks: {} };
    // hash reconstructed from individual columns — same path verify() uses
    const evidenceHash = evidence.hashEvidencePayload({
      recordId: '1001',
      deputyId: '25',
      sessionId: '431',
      registeredAt: now.toISOString(),
      validationPolicyId: 'POLICY_V1',
      validationResult: validationDetails,
      applicationId: 'attendance-backend',
      applicationVersion: '1.0.0',
      hashAlgorithm: 'keccak256',
    });
    mocks.prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue({
      id: 1001,
      deputyId: 25,
      sessionId: 431,
      registeredAt: now,
      validationPolicyId: 'POLICY_V1',
      status: 'SUBMITTED',
      validationDetailsJson: validationDetails,
      evidencePayloadJson: {},
      applicationId: 'attendance-backend',
      applicationVersion: '1.0.0',
      hashAlgorithm: 'keccak256',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    const blockchain = {
      registerAttendanceProof: vi.fn(),
      getOnChainHashForTx: vi.fn().mockResolvedValue({ recordId: '1001', hash: evidenceHash })
    };

    const result = await new AttendanceService(blockchain).verify('1001');

    expect(blockchain.getOnChainHashForTx).toHaveBeenCalledWith(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(result).not.toHaveProperty('evidenceHashMatches');
    expect(result).not.toHaveProperty('databaseHashMatches');
    expect(result.blockchainCheckAvailable).toBe(true);
    expect(result.blockchainRecordFound).toBe(true);
    expect(result.blockchainHashMatches).toBe(true);
    expect(result.overallResult).toBe('CHAIN_VALID');
    expect(result).not.toHaveProperty('signatureValid');
  });

  it('reports CHAIN_VERIFICATION_FAILED when on-chain hash diverges from recalculated hash', async () => {
    const validationDetails = { policy: 'POLICY_V1', policyVersion: 1, result: 'VALID', checkedAt: now.toISOString(), checks: {} };
    mocks.prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue({
      id: 1001,
      deputyId: 25,
      sessionId: 431,
      registeredAt: now,
      validationPolicyId: 'POLICY_V1',
      status: 'SUBMITTED',
      validationDetailsJson: validationDetails,
      evidencePayloadJson: {},
      applicationId: 'attendance-backend',
      applicationVersion: '1.0.0',
      hashAlgorithm: 'keccak256',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    const blockchain = {
      registerAttendanceProof: vi.fn(),
      getOnChainHashForTx: vi
        .fn()
        .mockResolvedValue({ recordId: '1001', hash: '0xdeadbeef'.padEnd(66, '0') })
    };

    const result = await new AttendanceService(blockchain).verify('1001');

    expect(result.blockchainHashMatches).toBe(false);
    expect(result.overallResult).toBe('CHAIN_VERIFICATION_FAILED');
  });

  it('reports CHAIN_VERIFICATION_FAILED when a DB column is tampered', async () => {
    // Simulates the attack: attacker changes deputyId column but leaves evidencePayloadJson intact.
    // verify() hashes from columns — so the tampered deputyId changes the hash → mismatch detected.
    const evidence = new EvidenceService(new HashService());
    const validationDetails = { policy: 'POLICY_V1', policyVersion: 1, result: 'VALID', checkedAt: now.toISOString(), checks: {} };
    const originalHash = evidence.hashEvidencePayload({
      recordId: '1001',
      deputyId: '25',       // original deputy
      sessionId: '431',
      registeredAt: now.toISOString(),
      validationPolicyId: 'POLICY_V1',
      validationResult: validationDetails,
      applicationId: 'attendance-backend',
      applicationVersion: '1.0.0',
      hashAlgorithm: 'keccak256',
    });
    mocks.prisma.attendanceRecord.findUniqueOrThrow.mockResolvedValue({
      id: 1001,
      deputyId: 99,          // tampered column — different deputy
      sessionId: 431,
      registeredAt: now,
      validationPolicyId: 'POLICY_V1',
      status: 'SUBMITTED',
      validationDetailsJson: validationDetails,
      evidencePayloadJson: {},  // irrelevant — verify() no longer reads this
      applicationId: 'attendance-backend',
      applicationVersion: '1.0.0',
      hashAlgorithm: 'keccak256',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    });
    const blockchain = {
      registerAttendanceProof: vi.fn(),
      getOnChainHashForTx: vi.fn().mockResolvedValue({ recordId: '1001', hash: originalHash })
    };

    const result = await new AttendanceService(blockchain).verify('1001');

    expect(result.blockchainHashMatches).toBe(false);
    expect(result.overallResult).toBe('CHAIN_VERIFICATION_FAILED');
  });
});
