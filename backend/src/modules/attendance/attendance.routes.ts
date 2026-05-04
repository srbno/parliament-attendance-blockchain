import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { submitAttendanceSchema } from './attendance.schemas.js';
import { AttendanceService } from './attendance.service.js';

function canReadOwn(user: { role: string; deputyId: string | null }, deputyId: string) {
  return user.role === 'DEPUTY' && user.deputyId === deputyId;
}

export async function attendanceRoutes(app: FastifyInstance) {
  const service = new AttendanceService();

  app.post('/attendance/submit', async (request) => {
    const user = await requireRoles(request, ['DEPUTY']);
    return service.submit(submitAttendanceSchema.parse(request.body), user, request.ip);
  });

  app.get<{ Params: { sessionId: string } }>('/attendance/session/:sessionId', async (request) => {
    await requireRoles(request, ['ADMIN', 'AUDITOR']);
    return service.listBySession(request.params.sessionId);
  });

  app.get<{ Params: { deputyId: string } }>('/attendance/deputy/:deputyId', async (request) => {
    const user = await requireAuth(request);
    if (!['ADMIN', 'AUDITOR'].includes(user.role) && !canReadOwn(user, request.params.deputyId)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
    return service.listByDeputy(request.params.deputyId);
  });

  app.get<{ Params: { id: string } }>('/attendance/:id/verify', async (request) => {
    const user = await requireAuth(request);
    const record = await service.get(request.params.id);
    if (!['ADMIN', 'AUDITOR'].includes(user.role) && !canReadOwn(user, record.deputyId)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
    return service.verify(request.params.id);
  });

  app.get<{ Params: { id: string } }>('/attendance/:id', async (request) => {
    const user = await requireAuth(request);
    const record = await service.get(request.params.id);
    if (!['ADMIN', 'AUDITOR'].includes(user.role) && !canReadOwn(user, record.deputyId)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
    return record;
  });
}
