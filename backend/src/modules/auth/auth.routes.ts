import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../../shared/auth/guards.js';
import { idToString } from '../../shared/id.js';
import { prisma } from '../../db/prisma.js';
import { loginSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  const service = new AuthService(app);

  app.post('/auth/login', async (request) => service.login(loginSchema.parse(request.body)));

  app.get('/auth/me', async (request) => {
    const tokenUser = await requireAuth(request);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: BigInt(tokenUser.sub) } });
    return {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      deputyId: idToString(user.deputyId),
      isActive: user.isActive
    };
  });
}
