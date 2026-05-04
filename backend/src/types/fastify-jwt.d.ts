import '@fastify/jwt';
import type { JWT } from '@fastify/jwt';
import type { JwtUser } from '../modules/auth/auth.types.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: JWT;
  }

  interface FastifyRequest {
    jwtVerify(): Promise<JwtUser>;
    user: JwtUser;
  }
}
