import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRoles } from '../../shared/auth/guards.js';
import { AppError } from '../../shared/errors/app-error.js';
import { createDeputySchema, updateDeputySchema } from './deputies.schemas.js';
import { DeputiesService } from './deputies.service.js';

export async function deputiesRoutes(app: FastifyInstance) {
  const service = new DeputiesService();

  app.post('/deputies', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.create(createDeputySchema.parse(request.body));
  });

  app.get('/deputies', async (request) => {
    await requireRoles(request, ['ADMIN', 'AUDITOR']);
    return service.list();
  });

  app.get<{ Params: { id: string } }>('/deputies/:id', async (request) => {
    const user = await requireAuth(request);
    if (!['ADMIN', 'AUDITOR'].includes(user.role) && user.deputyId !== request.params.id) {
      throw new AppError('FORBIDDEN', 'You do not have permission to perform this action.', 403);
    }
    return service.get(request.params.id);
  });

  app.patch<{ Params: { id: string } }>('/deputies/:id', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.update(request.params.id, updateDeputySchema.parse(request.body));
  });
}
