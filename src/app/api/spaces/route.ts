import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { resolveLocationId, assertLocationAccess, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '200', 10)));

    const resolvedLocationId = resolveLocationId(auth, locationId);

    const where: any = resolvedLocationId ? { locationId: resolvedLocationId } : {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { spaceNumber: { contains: search } },
      ];
    }

    const [total, spaces] = await prisma.$transaction([
      prisma.parkingSpace.count({ where }),
      prisma.parkingSpace.findMany({
        where,
        orderBy: [{ locationId: 'asc' }, { spaceNumber: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: spaces,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error('GET /api/spaces failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch spaces.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const body = await req.json();
    const { spaceNumber, locationId, status = 'available' } = body;
    const ip = getClientIp(req);

    if (!spaceNumber || typeof spaceNumber !== 'string' || spaceNumber.trim() === '') {
      return validationError('spaceNumber is required.');
    }
    if (!locationId || typeof locationId !== 'string') {
      return validationError('locationId is required.');
    }

    const VALID_STATUSES = ['available', 'occupied'];
    if (!VALID_STATUSES.includes(status)) {
      return validationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const accessError = assertLocationAccess(auth, locationId);
    if (accessError) return accessError;

    const space = await prisma.parkingSpace.create({
      data: { spaceNumber: spaceNumber.trim(), locationId, status },
    });

    await auditLog({
      actor: auth,
      action: `Created parking space: ${spaceNumber.trim()} at location ${locationId}`,
      category: 'parking_management',
      locationId,
      newValue: JSON.stringify({ spaceNumber: spaceNumber.trim(), status }),
      ipAddress: ip,
    });

    return NextResponse.json(space, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Space number already exists in this location.' },
        { status: 409 }
      );
    }
    logger.error('POST /api/spaces failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create space.' }, { status: 500 });
  }
}
