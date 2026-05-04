import { buildApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger/logger.js';

const app = await buildApp();

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  logger.info('server_started', { host: env.HOST, port: env.PORT });
} catch (error) {
  logger.error('server_start_failed', { message: error instanceof Error ? error.message : String(error) });
  process.exit(1);
}
