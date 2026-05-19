import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to seed the database');
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

const password = 'ChangeMe123!';
const passwordHash = await argon2.hash(password);
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

const deputy = await prisma.deputy.upsert({
  where: { publicIdentifier: 'DEP-25' },
  update: {
    name: 'Deputado Demo',
    party: 'Demo',
    electoralCircle: 'Lisboa',
    active: true
  },
  create: {
    publicIdentifier: 'DEP-25',
    name: 'Deputado Demo',
    party: 'Demo',
    electoralCircle: 'Lisboa',
    active: true
  }
});

await prisma.user.upsert({
  where: { username: 'admin' },
  update: { passwordHash, isActive: true },
  create: {
    username: 'admin',
    email: 'admin@example.local',
    passwordHash,
    role: 'ADMIN',
    isActive: true
  }
});

await prisma.user.upsert({
  where: { username: 'auditor' },
  update: { passwordHash, isActive: true },
  create: {
    username: 'auditor',
    email: 'auditor@example.local',
    passwordHash,
    role: 'AUDITOR',
    isActive: true
  }
});

await prisma.user.upsert({
  where: { username: 'deputy' },
  update: { passwordHash, deputyId: deputy.id, isActive: true },
  create: {
    username: 'deputy',
    email: 'deputy@example.local',
    passwordHash,
    role: 'DEPUTY',
    deputyId: deputy.id,
    isActive: true
  }
});

const location = await prisma.authorizedLocation.upsert({
  where: { id: 1 },
  update: {
    name: 'Palacio de Sao Bento - Demo',
    latitude: 38.7139,
    longitude: -9.1521,
    radiusMeters: 100,
    allowedIpRanges: ['127.0.0.1/32', '10.0.0.0/8'],
    active: true
  },
  create: {
    name: 'Palacio de Sao Bento - Demo',
    latitude: 38.7139,
    longitude: -9.1521,
    radiusMeters: 100,
    allowedIpRanges: ['127.0.0.1/32', '10.0.0.0/8'],
    active: true
  }
});

await prisma.parliamentarySession.upsert({
  where: { id: 1 },
  update: {
    title: 'Sessao Demo Aberta',
    sessionType: 'PLENARY',
    locationId: location.id,
    scheduledStart: yesterday,
    scheduledEnd: nextWeek,
    checkinStart: yesterday,
    checkinEnd: nextWeek,
    status: 'OPEN',
    allowMultipleCheckins: false
  },
  create: {
    title: 'Sessao Demo Aberta',
    sessionType: 'PLENARY',
    locationId: location.id,
    scheduledStart: yesterday,
    scheduledEnd: nextWeek,
    checkinStart: yesterday,
    checkinEnd: nextWeek,
    status: 'OPEN',
    allowMultipleCheckins: false
  }
});

await prisma.validationPolicy.upsert({
  where: { id: 'POLICY_V1' },
  update: {
    name: 'Phase 1 validation policy',
    version: 1,
    active: true,
    rulesJson: {
      requiredChecks: [
        'AUTHENTICATED_USER',
        'USER_IS_DEPUTY',
        'SESSION_EXISTS',
        'SESSION_OPEN',
        'TIMESTAMP_WITHIN_WINDOW',
        'NO_DUPLICATE_ATTENDANCE',
        'AUTHORIZED_IP',
        'GPS_WITHIN_RADIUS',
        'GPS_ACCURACY_ACCEPTABLE',
        'REPLAY_PROTECTION'
      ]
    }
  },
  create: {
    id: 'POLICY_V1',
    name: 'Phase 1 validation policy',
    version: 1,
    active: true,
    rulesJson: {
      requiredChecks: [
        'AUTHENTICATED_USER',
        'USER_IS_DEPUTY',
        'SESSION_EXISTS',
        'SESSION_OPEN',
        'TIMESTAMP_WITHIN_WINDOW',
        'NO_DUPLICATE_ATTENDANCE',
        'AUTHORIZED_IP',
        'GPS_WITHIN_RADIUS',
        'GPS_ACCURACY_ACCEPTABLE',
        'REPLAY_PROTECTION'
      ]
    }
  }
});

await prisma.$disconnect();

console.log(`Seed complete. Local demo password for admin, auditor and deputy: ${password}`);
