import type { FastifyInstance } from 'fastify';
import { requireRoles } from '../../shared/auth/guards.js';
import { createLocationSchema, updateLocationSchema } from './locations.schemas.js';
import { LocationsService } from './locations.service.js';

export async function locationsRoutes(app: FastifyInstance) {
  const service = new LocationsService();

  app.post('/locations', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.create(createLocationSchema.parse(request.body));
  });

  app.get('/locations', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.list();
  });

  app.patch<{ Params: { id: string } }>('/locations/:id', async (request) => {
    await requireRoles(request, ['ADMIN']);
    return service.update(request.params.id, updateLocationSchema.parse(request.body));
  });
}
