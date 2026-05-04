import { prisma } from '../../db/prisma.js';
import { parseBigIntId } from '../../shared/id.js';
import type { CreateSessionInput, UpdateSessionInput } from './sessions.schemas.js';

function sessionData(input: CreateSessionInput | UpdateSessionInput) {
  const data: Record<string, unknown> = { ...input };
  if (input.locationId) data.locationId = parseBigIntId(input.locationId);
  if (input.scheduledStart) data.scheduledStart = new Date(input.scheduledStart);
  if (input.scheduledEnd) data.scheduledEnd = new Date(input.scheduledEnd);
  if (input.checkinStart) data.checkinStart = new Date(input.checkinStart);
  if (input.checkinEnd) data.checkinEnd = new Date(input.checkinEnd);
  return data;
}

function serializeSession(session: {
  id: bigint;
  title: string;
  sessionType: string;
  locationId: bigint;
  scheduledStart: Date;
  scheduledEnd: Date;
  checkinStart: Date;
  checkinEnd: Date;
  status: string;
  allowMultipleCheckins: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: session.id.toString(),
    title: session.title,
    sessionType: session.sessionType,
    locationId: session.locationId.toString(),
    scheduledStart: session.scheduledStart.toISOString(),
    scheduledEnd: session.scheduledEnd.toISOString(),
    checkinStart: session.checkinStart.toISOString(),
    checkinEnd: session.checkinEnd.toISOString(),
    status: session.status,
    allowMultipleCheckins: session.allowMultipleCheckins,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

export class SessionsService {
  async create(input: CreateSessionInput) {
    return serializeSession(await prisma.parliamentarySession.create({ data: sessionData(input) as never }));
  }

  async list() {
    return (await prisma.parliamentarySession.findMany({ orderBy: { id: 'asc' } })).map(serializeSession);
  }

  async get(id: string) {
    return serializeSession(await prisma.parliamentarySession.findUniqueOrThrow({ where: { id: parseBigIntId(id) } }));
  }

  async update(id: string, input: UpdateSessionInput) {
    return serializeSession(
      await prisma.parliamentarySession.update({ where: { id: parseBigIntId(id) }, data: sessionData(input) as never })
    );
  }

  async open(id: string) {
    return serializeSession(
      await prisma.parliamentarySession.update({ where: { id: parseBigIntId(id) }, data: { status: 'OPEN' } })
    );
  }

  async close(id: string) {
    return serializeSession(
      await prisma.parliamentarySession.update({ where: { id: parseBigIntId(id) }, data: { status: 'CLOSED' } })
    );
  }
}
