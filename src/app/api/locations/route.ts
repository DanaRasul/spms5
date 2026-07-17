import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin, requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { isBranchScopedUser, normalizeSpacePrefix, ensureLocationSpaces, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '100', 10)));

    const where: any = {};
    if (isBranchScopedUser(auth) && auth.branchId) {
      where.id = auth.branchId;
    }
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
        { phoneNumber: { contains: search } },
      ];
    }

    const [total, locations] = await prisma.$transaction([
      prisma.parkingLocation.count({ where }),
      prisma.parkingLocation.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: locations,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error('GET /api/locations failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch locations.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSystemAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { name, address, phoneNumber, capacity, prefix, spacePrefix: spacePrefixInput, status, hourlyRate1, hourlyRate2, hourlyRate3 } = body;
    const ip = getClientIp(req);

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return validationError('name is required.');
    }
    const trimmedName = name.trim();

    const existingLocations = await prisma.parkingLocation.findMany({ select: { id: true, name: true } });
    const isDuplicateName = existingLocations.some(loc => loc.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (isDuplicateName) {
      return validationError('duplicateLocationName');
    }
    const rawPrefix = prefix || spacePrefixInput;
    if (!rawPrefix || typeof rawPrefix !== 'string' || rawPrefix.trim() === '') {
      return validationError('prefix is required.');
    }
    if (capacity === undefined || typeof capacity !== 'number' || capacity < 1) {
      return validationError('capacity is required and must be a positive number.');
    }

    const VALID_STATUSES = ['active', 'inactive'];
    if (status && !VALID_STATUSES.includes(status)) {
      return validationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const rateFields = { hourlyRate1, hourlyRate2, hourlyRate3 };
    for (const [key, value] of Object.entries(rateFields)) {
      if (value !== undefined && (typeof value !== 'number' || value < 0)) {
        return validationError(`${key} must be a non-negative number.`);
      }
    }

    const spacePrefix = normalizeSpacePrefix(rawPrefix);

    const location = await prisma.$transaction(async (tx) => {
      const created = await tx.parkingLocation.create({
        data: {
          name: trimmedName,
          address: typeof address === 'string' && address.trim() ? address.trim() : trimmedName,
          phoneNumber: phoneNumber || null,
          capacity,
          spacePrefix,
          status: status || 'active',
          ...(hourlyRate1 !== undefined ? { hourlyRate1 } : {}),
          ...(hourlyRate2 !== undefined ? { hourlyRate2 } : {}),
          ...(hourlyRate3 !== undefined ? { hourlyRate3 } : {}),
        },
      });
      await ensureLocationSpaces(tx, created.id, capacity, spacePrefix);
      return created;
    });

    await auditLog({
      actor: auth,
      action: `Created parking location: ${trimmedName}`,
      category: 'parking_management',
      newValue: JSON.stringify({ name: trimmedName, capacity, spacePrefix }),
      ipAddress: ip,
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    logger.error('POST /api/locations failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create location.' }, { status: 500 });
  }
}
