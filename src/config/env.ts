import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),
  APP_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  MAX_GPS_ACCURACY_METERS: z.coerce.number().positive().default(100),
  DEFAULT_CHECKIN_RADIUS_METERS: z.coerce.number().positive().default(100),
  HASH_ALGORITHM: z.literal('keccak256').default('keccak256'),
  BLOCKCHAIN_MODE: z.literal('mock').default('mock'),
  APPLICATION_ID: z.string().default('attendance-backend'),
  APPLICATION_VERSION: z.string().default('1.0.0')
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}

export const env = loadEnv();
