import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin, requireAdmin, isErrorResponse, notFound, validationError } from '@/lib/apiAuth';
import { normalizeSpacePrefix, deriveLocationPrefix, reconcileLocationCapacity, assertLocationAccess, isBranchScopedUser } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

const RATE_FIELDS = ['hourlyRate1', 'hourlyRate2', 'hourlyRate3'] as const;

// Every field prisma.parkingLocation.update() actually accepts. userId/username/
// userRole (sent by the client purely for audit-log attribution elsewhere) and
// any other stray body fields must never reach Prisma directly.
const ALLOWED_LOCATION_FIELDS = ['name', 'address', 'phoneNumber', 'capacity', 'prefix', 'spacePrefix', 'status', ...RATE_FIELDS] as const;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;

  const accessError = assertLocationAccess(auth, id);
  if (accessError) return accessError;

  try {
    const body = await req.json();
    const ip = getClientIp(req);

    // A branch_admin may only update their own branch's parking fee rates —
    // not the name, capacity, status, or space prefix (system_admin only).
    const rawData: Record<string, unknown> = isBranchScopedUser(auth)
      ? Object.fromEntries(RATE_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]))
      : Object.fromEntries(ALLOWED_LOCATION_FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
    const data: Record<string, unknown> = rawData;

    const existing = await prisma.parkingLocation.findUnique({ where: { id } });
    if (!existing) return notFound('Parking location');

    for (const field of RATE_FIELDS) {
      if (data[field] !== undefined && (typeof data[field] !== 'number' || (data[field] as number) < 0)) {
        return validationError(`${field} must be a non-negative number.`);
      }
    }

    if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim() === '')) {
      return validationError('name cannot be empty.');
    }
    if (typeof data.name === 'string') {
      const trimmedName = data.name.trim();
      const otherLocations = await prisma.parkingLocation.findMany({
        where: { id: { not: id } },
        select: { id: true, name: true },
      });
      const isDuplicateName = otherLocations.some(loc => loc.name.trim().toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicateName) {
        return validationError('duplicateLocationName');
      }
    }
    if (data.capacity !== undefined && (typeof data.capacity !== 'number' || (data.capacity as number) < 1)) {
      return validationError('capacity must be a positive number.');
    }
    const VALID_STATUSES = ['active', 'inactive'];
    if (data.status !== undefined && !VALID_STATUSES.includes(data.status as string)) {
      return validationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    if (typeof data.name === 'string') data.name = data.name.trim();
    if (typeof data.address === 'string') data.address = data.address.trim();
    if (data.prefix !== undefined || data.spacePrefix !== undefined) {
      const rawPrefix = data.prefix || data.spacePrefix;
      if (typeof rawPrefix !== 'string' || rawPrefix.trim() === '') {
        return validationError('prefix cannot be empty.');
      }
      data.spacePrefix = normalizeSpacePrefix(rawPrefix);
      delete data.prefix;
    }

    if (Object.keys(data).length === 0) {
      return validationError('No valid fields provided.');
    }

    const location = await prisma.parkingLocation.update({ where: { id }, data });

    if (data.capacity !== undefined && data.capacity !== existing.capacity) {
      const prefix = location.spacePrefix || deriveLocationPrefix(location.name);
      try {
        await reconcileLocationCapacity(prisma, id, data.capacity, prefix);
      } catch (error: any) {
        if (error.code === 'CAPACITY_BELOW_OCCUPIED') {
          return NextResponse.json(
            { error: 'Conflict', message: 'capacityBelowOccupied' },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    await auditLog({
      actor: auth,
      action: `Updated parking location: ${existing.name}`,
      category: 'parking_management',
      oldValue: JSON.stringify({ name: existing.name, status: existing.status, capacity: existing.capacity }),
      newValue: JSON.stringify({ name: location.name, status: location.status, capacity: location.capacity }),
      locationId: id,
      ipAddress: ip,
    });

    return NextResponse.json(location);
  } catch (error) {
    logger.error(`PUT /api/locations/[id] failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update location.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSystemAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const { id } = await params;
    const ip = getClientIp(req);

    const location = await prisma.parkingLocation.findUnique({ where: { id } });
    if (!location) return notFound('Parking location');

    const activeVehicles = await prisma.vehicleRecord.count({
      where: { locationId: id, status: 'inside' },
    });

    if (activeVehicles > 0) {
      return NextResponse.json(
        { error: 'Conflict', message: 'cannotDeleteLocationWithVehicles' },
        { status: 409 }
      );
    }

    await prisma.parkingLocation.delete({ where: { id } });

    await auditLog({
      actor: auth,
      action: `Deleted parking location: ${location.name}`,
      category: 'parking_management',
      oldValue: JSON.stringify({ name: location.name, address: location.address }),
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`DELETE /api/locations/[id] failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete location.' }, { status: 500 });
  }
}
