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
const d = (offsetDays: number) => new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);

// ──────────────────────────────────────────
// Localização
// ──────────────────────────────────────────
const location = await prisma.authorizedLocation.upsert({
  where: { id: 1 },
  update: {
    name: 'Palácio de São Bento — Hemiciclo',
    latitude: 38.7139,
    longitude: -9.1521,
    radiusMeters: 150,
    allowedIpRanges: ['127.0.0.1/32', '10.0.0.0/8', '192.168.0.0/16'],
    active: true,
  },
  create: {
    name: 'Palácio de São Bento — Hemiciclo',
    latitude: 38.7139,
    longitude: -9.1521,
    radiusMeters: 150,
    allowedIpRanges: ['127.0.0.1/32', '10.0.0.0/8', '192.168.0.0/16'],
    active: true,
  },
});

// ──────────────────────────────────────────
// Política de validação
// ──────────────────────────────────────────
await prisma.validationPolicy.upsert({
  where: { id: 'POLICY_V1' },
  update: {
    name: 'Política de Validação v1',
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
        'REPLAY_PROTECTION',
      ],
    },
  },
  create: {
    id: 'POLICY_V1',
    name: 'Política de Validação v1',
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
        'REPLAY_PROTECTION',
      ],
    },
  },
});

// ──────────────────────────────────────────
// Deputados
// ──────────────────────────────────────────
const deputyData = [
  { publicIdentifier: 'DEP-001', name: 'Ana Maria Ferreira',      party: 'PS',    electoralCircle: 'Lisboa',   active: true },
  { publicIdentifier: 'DEP-002', name: 'João Carlos Oliveira',    party: 'PSD',   electoralCircle: 'Porto',    active: true },
  { publicIdentifier: 'DEP-003', name: 'Maria Teresa Santos',     party: 'Chega', electoralCircle: 'Braga',    active: true },
  { publicIdentifier: 'DEP-004', name: 'Ricardo Filipe Costa',    party: 'IL',    electoralCircle: 'Setúbal',  active: true },
  { publicIdentifier: 'DEP-005', name: 'Catarina Isabel Mendes',  party: 'BE',    electoralCircle: 'Coimbra',  active: true },
  { publicIdentifier: 'DEP-006', name: 'António Manuel Rodrigues',party: 'PCP',   electoralCircle: 'Aveiro',   active: true },
  { publicIdentifier: 'DEP-007', name: 'Sofia Alexandra Pinto',   party: 'PS',    electoralCircle: 'Faro',     active: true },
  { publicIdentifier: 'DEP-008', name: 'Luís Fernando Carvalho',  party: 'PSD',   electoralCircle: 'Viseu',    active: true },
  { publicIdentifier: 'DEP-009', name: 'Helena Cristina Lopes',   party: 'PAN',   electoralCircle: 'Leiria',   active: true },
  { publicIdentifier: 'DEP-010', name: 'Pedro Nuno Barbosa',      party: 'PS',    electoralCircle: 'Santarém', active: true },
];

const deputies = [];
for (const dep of deputyData) {
  const d_ = await prisma.deputy.upsert({
    where: { publicIdentifier: dep.publicIdentifier },
    update: dep,
    create: dep,
  });
  deputies.push(d_);
}

// Deputado principal ligado ao utilizador 'deputy'
const mainDeputy = deputies[0];

// ──────────────────────────────────────────
// Utilizadores
// ──────────────────────────────────────────
await prisma.user.upsert({
  where: { username: 'admin' },
  update: { passwordHash, isActive: true },
  create: { username: 'admin', email: 'admin@parlamento.local', passwordHash, role: 'ADMIN', isActive: true },
});

await prisma.user.upsert({
  where: { username: 'auditor' },
  update: { passwordHash, isActive: true },
  create: { username: 'auditor', email: 'auditor@parlamento.local', passwordHash, role: 'AUDITOR', isActive: true },
});

await prisma.user.upsert({
  where: { username: 'deputy' },
  update: { passwordHash, deputyId: mainDeputy.id, isActive: true },
  create: { username: 'deputy', email: 'deputy@parlamento.local', passwordHash, role: 'DEPUTY', deputyId: mainDeputy.id, isActive: true },
});

// ──────────────────────────────────────────
// Sessões parlamentares
// ──────────────────────────────────────────
const sessionsData = [
  {
    id: 1,
    title: 'Plenária — Debate sobre o Orçamento do Estado 2026',
    sessionType: 'PLENARY' as const,
    scheduledStart: d(-30), scheduledEnd: d(-29),
    checkinStart: d(-30), checkinEnd: d(-29),
    status: 'CLOSED' as const,
    allowMultipleCheckins: false,
  },
  {
    id: 2,
    title: 'Plenária — Votação Final Global do OE 2026',
    sessionType: 'VOTING' as const,
    scheduledStart: d(-25), scheduledEnd: d(-25),
    checkinStart: d(-25), checkinEnd: d(-25),
    status: 'CLOSED' as const,
    allowMultipleCheckins: false,
  },
  {
    id: 3,
    title: 'Comissão de Saúde — Audição Pública sobre o SNS',
    sessionType: 'COMMITTEE' as const,
    scheduledStart: d(-15), scheduledEnd: d(-15),
    checkinStart: d(-15), checkinEnd: d(-15),
    status: 'CLOSED' as const,
    allowMultipleCheckins: false,
  },
  {
    id: 4,
    title: 'Plenária — Debate sobre Política de Habitação',
    sessionType: 'PLENARY' as const,
    scheduledStart: d(-7), scheduledEnd: d(-6),
    checkinStart: d(-7), checkinEnd: d(-6),
    status: 'CLOSED' as const,
    allowMultipleCheckins: false,
  },
  {
    id: 5,
    title: 'Plenária — Questões ao Governo (Sessão Quinzenal)',
    sessionType: 'PLENARY' as const,
    scheduledStart: d(-1), scheduledEnd: d(7),
    checkinStart: d(-1), checkinEnd: d(7),
    status: 'OPEN' as const,
    allowMultipleCheckins: false,
  },
  {
    id: 6,
    title: 'Comissão de Educação — Análise do Plano de Recuperação Escolar',
    sessionType: 'COMMITTEE' as const,
    scheduledStart: d(3), scheduledEnd: d(3),
    checkinStart: d(3), checkinEnd: d(3),
    status: 'DRAFT' as const,
    allowMultipleCheckins: false,
  },
];

let sessionCount = 0;
for (const s of sessionsData) {
  const { id, ...rest } = s;
  await prisma.parliamentarySession.upsert({
    where: { id },
    update: { ...rest, locationId: location.id },
    create: { id, ...rest, locationId: location.id },
  });
  sessionCount++;
}

await prisma.$disconnect();

console.log(`
Seed concluído.
  Deputados:  ${deputies.length}
  Sessões:    ${sessionCount}
  Password:   ${password}

Presenças devem ser submetidas via API (POST /attendance/submit) para garantir
integridade: evidence hash calculada, txHash real na blockchain, status correto.
`);
