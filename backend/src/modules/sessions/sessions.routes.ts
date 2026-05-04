import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRoles } from '../../shared/auth/guards.js';
import { createSessionSchema, updateSessionSchema } from './sessions.schemas.js';
import { SessionsService } from './sessions.service.js';

export async function sessionsRoutes(app: FastifyInstance) {
  const service = new SessionsService();

  app.post('/sessions', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.create(createSessionSchema.parse(request.body));
  });

  app.get('/sessions', async (request) => {
    await requireAuth(request);
    return service.list();
  });

  app.get<{ Params: { id: string } }>('/sessions/:id', async (request) => {
    await requireAuth(request);
    return service.get(request.params.id);
  });

  app.patch<{ Params: { id: string } }>('/sessions/:id', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.update(request.params.id, updateSessionSchema.parse(request.body));
  });

  app.post<{ Params: { id: string } }>('/sessions/:id/open', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.open(request.params.id);
  });

  app.post<{ Params: { id: string } }>('/sessions/:id/close', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.close(request.params.id);
  });
}
