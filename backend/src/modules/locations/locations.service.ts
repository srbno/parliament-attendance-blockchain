import { prisma } from '../../db/prisma.js';
import { parseBigIntId } from '../../shared/id.js';
import type { CreateLocationInput, UpdateLocationInput } from './locations.schemas.js';

function serializeLocation(location: {
  id: bigint;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  allowedIpRanges: unknown;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: location.id.toString(),
    name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    radiusMeters: location.radiusMeters,
    allowedIpRanges: location.allowedIpRanges,
    active: location.active,
    createdAt: location.createdAt.toISOString(),
    updatedAt: location.updatedAt.toISOString()
  };
}

export class LocationsService {
  async create(input: CreateLocationInput) {
    return serializeLocation(await prisma.authorizedLocation.create({ data: input }));
  }

  async list() {
    return (await prisma.authorizedLocation.findMany({ orderBy: { id: 'asc' } })).map(serializeLocation);
  }

  async update(id: string, input: UpdateLocationInput) {
    return serializeLocation(
      await prisma.authorizedLocation.update({ where: { id: parseBigIntId(id) }, data: input })
    );
  }
}
