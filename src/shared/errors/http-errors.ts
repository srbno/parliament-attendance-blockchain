import { AppError } from './app-error.js';

export const errors = {
  unauthorized: () => new AppError('UNAUTHORIZED', 'Authentication is required.', 401),
  forbidden: () => new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403),
  notFound: (resource: string) => new AppError('NOT_FOUND', `${resource} was not found.`, 404),
  validation: (code: string, message: string, details: Record<string, unknown> = {}) =>
    new AppError(code, message, 400, details)
};
