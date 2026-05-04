import Fastify from 'fastify';
import { authPlugin } from './plugins/auth.plugin.js';
import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { deputiesRoutes } from './modules/deputies/deputies.routes.js';
import { sessionsRoutes } from './modules/sessions/sessions.routes.js';
import { locationsRoutes } from './modules/locations/locations.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';

export async function buildApp() {
  const app = Fastify({
    logger: false,
    trustProxy: false
  });

  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);
  await app.register(authRoutes);
  await app.register(deputiesRoutes);
  await app.register(sessionsRoutes);
  await app.register(locationsRoutes);
  await app.register(attendanceRoutes);

  return app;
}
