import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

if (existsSync('.env')) {
  loadEnvFile('.env');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  MAX_GPS_ACCURACY_METERS: z.coerce.number().positive().default(100),
  DEFAULT_CHECKIN_RADIUS_METERS: z.coerce.number().positive().default(100),
  HASH_ALGORITHM: z.literal('keccak256').default('keccak256'),
  BLOCKCHAIN_MODE: z.literal('mock').default('mock'),
  BLOCKCHAIN_RPC_URL: z.string().url().default('http://127.0.0.1:8545'),
  BLOCKCHAIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/)
    .default('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'),
  ATTENDANCE_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .default('0x5FbDB2315678afecb367f032d93F642f64180aa3'),
  APPLICATION_ID: z.string().default('attendance-backend'),
  APPLICATION_VERSION: z.string().default('1.0.0'),
  EVIDENCE_HASH_SEED: z
    .string()
    .regex(/^[0-9a-fA-F]+$/, 'EVIDENCE_HASH_SEED must be a hex string')
    .min(32, 'EVIDENCE_HASH_SEED must be at least 16 bytes (32 hex chars)')
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
