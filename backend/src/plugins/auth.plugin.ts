import fastifyJwt from '@fastify/jwt';
import { env } from '../config/env.js';

export async function authPlugin(app: import('fastify').FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN_SECONDS
    }
  });
}
