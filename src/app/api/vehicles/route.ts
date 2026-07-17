import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { resolveLocationWhere, assertLocationAccess, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logApiError, mapPrismaError } from '@/lib/logger';

const TX_OPTIONS = { maxWait: 5000, timeout: 10000 } as const;

const vehicleListSelect = {
  id: true,
  plateNumber: true,
  parkingSpaceId: true,
  parkingSpaceNumber: true,
  locationId: true,
  entryDate: true,
  entryTime: true,
  exitDate: true,
  exitTime: true,
  duration: true,
  fee: true,
  status: true,
  driverName: true,
  vehicleType: true,
  vehicleColor: true,
  editHistory: true,
  loyaltyRewardUsed: true,
  qrToken: true,
  receiptNumber: true,
  receiptGeneratedAt: true,
  createdAt: true,
} as const;

function plateLockKey(plate: string): string {
  return `spms_plate_${plate}`;
}

async function acquireNamedLock(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string): Promise<void> {
  const result = await tx.$queryRaw<{ got: number | bigint | null }[]>`
    SELECT GET_LOCK(${key}, 10) AS got
  `;
  const got = result[0]?.got;
  if (Number(got) !== 1) {
    throw Object.assign(new Error('Failed to acquire plate lock'), { code: 'LOCK_TIMEOUT' });
  }
}

async function releaseNamedLock(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string): Promise<void> {
  await tx.$executeRaw`SELECT RELEASE_LOCK(${key})`;
}

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
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const allowedSortFields = ['createdAt', 'plateNumber', 'entryDate', 'status', 'fee'];
    const resolvedSort = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const where: any = { ...resolveLocationWhere(auth, locationId) };

    if (status) where.status = status;

    if (search) {
      where.OR = [
        { plateNumber: { contains: search } },
        { driverName: { contains: search } },
        { parkingSpaceNumber: { contains: search } },
        { vehicleType: { contains: search } },
      ];
    }

    const [total, vehicles] = await prisma.$transaction([
      prisma.vehicleRecord.count({ where }),
      prisma.vehicleRecord.findMany({
        where,
        select: vehicleListSelect,
        orderBy: { [resolvedSort]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: vehicles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logApiError('GET /api/vehicles failed', error, { endpoint: 'GET /api/vehicles', method: 'GET' });
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch vehicles.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const body = await req.json();
    const {
      plateNumber,
      parkingSpaceId,
      parkingSpaceNumber,
      locationId,
      entryDate,
      entryTime,
      driverName,
      vehicleType,
      vehicleColor,
    } = body;

    if (!plateNumber || typeof plateNumber !== 'string' || plateNumber.trim() === '') {
      return validationError('plateNumber is required.');
    }
    if (!parkingSpaceId || typeof parkingSpaceId !== 'string') {
      return validationError('parkingSpaceId is required.');
    }
    if (!parkingSpaceNumber || typeof parkingSpaceNumber !== 'string') {
      return validationError('parkingSpaceNumber is required.');
    }
    if (!locationId || typeof locationId !== 'string') {
      return validationError('locationId is required.');
    }
    if (!entryDate || typeof entryDate !== 'string') {
      return validationError('entryDate is required.');
    }
    if (!entryTime || typeof entryTime !== 'string') {
      return validationError('entryTime is required.');
    }

    const accessError = assertLocationAccess(auth, locationId);
    if (accessError) return accessError;

    const normalizedPlate = plateNumber.trim().toUpperCase();
    const qrToken = randomUUID();
    const ip = getClientIp(req);
    const lockKey = plateLockKey(normalizedPlate);

    const vehicleData = {
      plateNumber: normalizedPlate,
      parkingSpaceId,
      parkingSpaceNumber,
      locationId,
      entryDate,
      entryTime,
      status: 'inside' as const,
      driverName: driverName || null,
      vehicleType: vehicleType || null,
      vehicleColor: vehicleColor || null,
      qrToken,
    };

    const vehicle = await prisma.$transaction(async (tx) => {
      await acquireNamedLock(tx, lockKey);

      try {
        const duplicateActive = await tx.vehicleRecord.findFirst({
          where: { plateNumber: normalizedPlate, status: 'inside' },
          select: { id: true },
        });
        if (duplicateActive) {
          throw Object.assign(new Error('vehicleAlreadyInside'), { code: 'DUPLICATE_ACTIVE' });
        }

        const spaceClaim = await tx.parkingSpace.updateMany({
          where: {
            id: parkingSpaceId,
            status: 'available',
            locationId,
          },
          data: { status: 'occupied' },
        });
        if (spaceClaim.count === 0) {
          throw Object.assign(new Error('spaceNotAvailable'), { code: 'SPACE_UNAVAILABLE' });
        }

        return tx.vehicleRecord.create({ data: vehicleData });
      } finally {
        await releaseNamedLock(tx, lockKey);
      }
    }, TX_OPTIONS);

    void auditLog({
      actor: auth,
      action: `Vehicle entry: ${normalizedPlate} → Space ${parkingSpaceNumber}`,
      category: 'vehicle',
      locationId,
      newValue: `${normalizedPlate} @ ${parkingSpaceNumber}`,
      ipAddress: ip,
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error: unknown) {
    const mapped = mapPrismaError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status });
    }
    logApiError('POST /api/vehicles failed', error, { endpoint: 'POST /api/vehicles', method: 'POST' });
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to register entry.' }, { status: 500 });
  }
}
