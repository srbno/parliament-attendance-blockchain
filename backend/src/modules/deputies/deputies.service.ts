import { prisma } from '../../db/prisma.js';
import { parseBigIntId } from '../../shared/id.js';
import type { CreateDeputyInput, UpdateDeputyInput } from './deputies.schemas.js';

function serializeDeputy(deputy: {
  id: bigint;
  publicIdentifier: string;
  name: string;
  party: string;
  electoralCircle: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: deputy.id.toString(),
    publicIdentifier: deputy.publicIdentifier,
    name: deputy.name,
    party: deputy.party,
    electoralCircle: deputy.electoralCircle,
    active: deputy.active,
    createdAt: deputy.createdAt.toISOString(),
    updatedAt: deputy.updatedAt.toISOString()
  };
}

export class DeputiesService {
  async create(input: CreateDeputyInput) {
    return serializeDeputy(await prisma.deputy.create({ data: input }));
  }

  async list() {
    return (await prisma.deputy.findMany({ orderBy: { id: 'asc' } })).map(serializeDeputy);
  }

  async get(id: string) {
    return serializeDeputy(await prisma.deputy.findUniqueOrThrow({ where: { id: parseBigIntId(id) } }));
  }

  async update(id: string, input: UpdateDeputyInput) {
    return serializeDeputy(await prisma.deputy.update({ where: { id: parseBigIntId(id) }, data: input }));
  }
}
