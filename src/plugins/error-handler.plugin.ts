import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/app-error.js';
import { logger } from '../shared/logger/logger.js';

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error, _request, reply) => {
    const prismaCode =
      typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : null;

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }

    if (prismaCode === 'P2025') {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          details: {}
        }
      });
    }

    if (prismaCode === 'P2002') {
      return reply.status(409).send({
        error: {
          code: 'CONFLICT',
          message: 'A record with the same unique value already exists.',
          details: {}
        }
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: { issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }
        }
      });
    }

    logger.error('internal_error', { message: error instanceof Error ? error.message : String(error) });
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred.',
        details: {}
      }
    });
  });
}
