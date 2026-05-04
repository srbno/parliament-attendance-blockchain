import type { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../errors/app-error.js';
import type { JwtUser } from '../../modules/auth/auth.types.js';

export async function requireAuth(request: FastifyRequest): Promise<JwtUser> {
  try {
    await request.jwtVerify();
  } catch {
    throw new AppError('UNAUTHORIZED', 'Authentication is required.', 401);
  }

  const tokenUser = request.user;
  const user = await prisma.user.findUnique({ where: { id: BigInt(tokenUser.sub) } });
  if (!user?.isActive) {
    throw new AppError('UNAUTHORIZED', 'Authentication is required.', 401);
  }

  return tokenUser;
}

export async function requireRoles(
  request: FastifyRequest,
  roles: Array<'ADMIN' | 'DEPUTY' | 'AUDITOR'>
): Promise<JwtUser> {
  const user = await requireAuth(request);
  if (!roles.includes(user.role)) {
    throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
  }
  return user;
}
