import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://attendance:attendance@localhost:5432/attendance';
process.env.JWT_SECRET ??= '12345678901234567890123456789012';
process.env.APP_PRIVATE_KEY ??= '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MAX_GPS_ACCURACY_METERS ??= '100';
process.env.HASH_ALGORITHM ??= 'keccak256';
process.env.BLOCKCHAIN_MODE ??= 'mock';

let app: FastifyInstance;
let prisma: Awaited<typeof import('../../src/db/prisma.js')>['prisma'];

async function resetDatabase() {
  await prisma.auditLog.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.parliamentarySession.deleteMany();
  await prisma.authorizedLocation.deleteMany();
  await prisma.validationPolicy.deleteMany();
  await prisma.deputy.deleteMany();
}

async function createFixture(overrides: {
  allowedIpRanges?: string[];
  sessionStatus?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  checkinStart?: Date;
  checkinEnd?: Date;
} = {}) {
  const passwordHash = await argon2.hash('ChangeMe123!');
  const now = new Date();
  const deputy = await prisma.deputy.create({
    data: {
      publicIdentifier: `DEP-${crypto.randomUUID()}`,
      name: 'Deputado Teste',
      party: 'T',
      electoralCircle: 'Lisboa',
      active: true
    }
  });
  const [admin, auditor, deputyUser] = await Promise.all([
    prisma.user.create({
      data: {
        username: `admin-${crypto.randomUUID()}`,
        email: `${crypto.randomUUID()}@admin.test`,
        passwordHash,
        role: 'ADMIN',
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        username: `auditor-${crypto.randomUUID()}`,
        email: `${crypto.randomUUID()}@auditor.test`,
        passwordHash,
        role: 'AUDITOR',
        isActive: true
      }
    }),
    prisma.user.create({
      data: {
        username: `deputy-${crypto.randomUUID()}`,
        email: `${crypto.randomUUID()}@deputy.test`,
        passwordHash,
        role: 'DEPUTY',
        deputyId: deputy.id,
        isActive: true
      }
    })
  ]);
  const location = await prisma.authorizedLocation.create({
    data: {
      name: 'Sao Bento Teste',
      latitude: 38.7139,
      longitude: -9.1521,
      radiusMeters: 100,
      allowedIpRanges: overrides.allowedIpRanges ?? ['127.0.0.1/32'],
      active: true
    }
  });
  const session = await prisma.parliamentarySession.create({
    data: {
      title: 'Sessao Teste',
      sessionType: 'PLENARY',
      locationId: location.id,
      scheduledStart: new Date(now.getTime() - 60_000),
      scheduledEnd: new Date(now.getTime() + 60_000),
      checkinStart: overrides.checkinStart ?? new Date(now.getTime() - 60_000),
      checkinEnd: overrides.checkinEnd ?? new Date(now.getTime() + 60_000),
      status: overrides.sessionStatus ?? 'OPEN',
      allowMultipleCheckins: false
    }
  });
  await prisma.validationPolicy.create({
    data: {
      id: 'POLICY_V1',
      name: 'Policy V1',
      version: 1,
      rulesJson: { requiredChecks: ['POLICY_V1'] },
      active: true
    }
  });

  return { admin, auditor, deputy, deputyUser, session };
}

async function login(username: string, password = 'ChangeMe123!') {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { username, password }
  });
  return response.json() as { accessToken: string };
}

async function submit(token: string, sessionId: bigint, payload: Record<string, unknown> = {}, remoteAddress = '127.0.0.1') {
  return app.inject({
    method: 'POST',
    url: '/attendance/submit',
    remoteAddress,
    headers: { authorization: `Bearer ${token}` },
    payload: {
      sessionId: sessionId.toString(),
      gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 20 },
      clientRequestId: crypto.randomUUID(),
      ...payload
    }
  });
}

beforeAll(async () => {
  ({ prisma } = await import('../../src/db/prisma.js'));
  const appModule = await import('../../src/app.js');
  app = await appModule.buildApp();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('auth API', () => {
  it('logs in with valid credentials and rejects invalid credentials', async () => {
    const { deputyUser } = await createFixture();

    const success = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: deputyUser.username, password: 'ChangeMe123!' }
    });
    const failure = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { username: deputyUser.username, password: 'wrong' }
    });

    expect(success.statusCode).toBe(200);
    expect(success.json().accessToken).toEqual(expect.any(String));
    expect(failure.statusCode).toBe(401);
    expect(failure.json().error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('attendance API', () => {
  it('submits valid attendance and returns READY_FOR_CHAIN', async () => {
    const { deputyUser, session } = await createFixture();
    const { accessToken } = await login(deputyUser.username);

    const response = await submit(accessToken, session.id);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'READY_FOR_CHAIN',
      deputyId: deputyUser.deputyId!.toString(),
      sessionId: session.id.toString(),
      validationPolicyId: 'POLICY_V1',
      blockchain: {
        submitted: false,
        txHash: null,
        blockNumber: null,
        reason: 'Blockchain integration not implemented yet'
      }
    });
    expect(response.json()).not.toHaveProperty('validationResultHash');
    expect(response.json().evidenceHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('rejects invalid IP, GPS distance, GPS accuracy, closed window, and duplicate attendance', async () => {
    const { deputyUser, session } = await createFixture();
    const { accessToken } = await login(deputyUser.username);

    expect((await submit(accessToken, session.id, {}, '8.8.8.8')).json().error.code).toBe('IP_NOT_AUTHORIZED');
    expect(
      (
        await submit(accessToken, session.id, {
          gps: { latitude: 38.72, longitude: -9.16, accuracyMeters: 20 }
        })
      ).json().error.code
    ).toBe('GPS_OUT_OF_RANGE');
    expect(
      (
        await submit(accessToken, session.id, {
          gps: { latitude: 38.714, longitude: -9.152, accuracyMeters: 150 }
        })
      ).json().error.code
    ).toBe('GPS_ACCURACY_TOO_LOW');

    await resetDatabase();
    const closed = await createFixture({
      checkinStart: new Date(Date.now() - 120_000),
      checkinEnd: new Date(Date.now() - 60_000)
    });
    const closedToken = (await login(closed.deputyUser.username)).accessToken;
    expect((await submit(closedToken, closed.session.id)).json().error.code).toBe('CHECKIN_WINDOW_CLOSED');

    await resetDatabase();
    const duplicate = await createFixture();
    const duplicateToken = (await login(duplicate.deputyUser.username)).accessToken;
    expect((await submit(duplicateToken, duplicate.session.id)).statusCode).toBe(200);
    const duplicateResponse = await submit(duplicateToken, duplicate.session.id);
    expect(duplicateResponse.statusCode).toBe(400);
    expect(duplicateResponse.json().error.code).toBe('DUPLICATE_ATTENDANCE');
  });

  it('verifies local evidence and detects tampered evidence payloads', async () => {
    const { deputyUser, session } = await createFixture();
    const { accessToken } = await login(deputyUser.username);
    const submitResponse = await submit(accessToken, session.id);
    const recordId = submitResponse.json().recordId as string;

    const verifyResponse = await app.inject({
      method: 'GET',
      url: `/attendance/${recordId}/verify`,
      headers: { authorization: `Bearer ${accessToken}` }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json()).toMatchObject({
      databaseHashMatches: true,
      evidenceHashMatches: true,
      signatureValid: true,
      blockchainRecordFound: false,
      blockchainCheckAvailable: false,
      overallResult: 'LOCALLY_VALID_READY_FOR_CHAIN'
    });
    expect(verifyResponse.json()).not.toHaveProperty('validationResultHashMatches');

    await prisma.attendanceRecord.update({
      where: { id: BigInt(recordId) },
      data: { evidencePayloadJson: { tampered: true } }
    });

    const tamperedResponse = await app.inject({
      method: 'GET',
      url: `/attendance/${recordId}/verify`,
      headers: { authorization: `Bearer ${accessToken}` }
    });
    expect(tamperedResponse.json().evidenceHashMatches).toBe(false);
    expect(tamperedResponse.json().overallResult).toBe('LOCAL_VERIFICATION_FAILED');
  });
});
