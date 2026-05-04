import argon2 from 'argon2';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/app-error.js';
import { idToString } from '../../shared/id.js';
import { logger } from '../../shared/logger/logger.js';
import { env } from '../../config/env.js';
import type { LoginInput } from './auth.schemas.js';

export class AuthService {
  constructor(private readonly app: FastifyInstance) {}

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user?.isActive || !(await argon2.verify(user.passwordHash, input.password))) {
      logger.warn('login_failed', { username: input.username });
      throw new AppError('INVALID_CREDENTIALS', 'Invalid username or password.', 401);
    }

    const deputyId = idToString(user.deputyId);
    const accessToken = this.app.jwt.sign({
      sub: user.id.toString(),
      role: user.role,
      deputyId
    });

    logger.info('login_success', { userId: user.id.toString(), role: user.role });
    return {
      accessToken,
      tokenType: 'bearer',
      expiresIn: env.JWT_EXPIRES_IN_SECONDS,
      user: {
        id: user.id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        deputyId
      }
    };
  }
}
