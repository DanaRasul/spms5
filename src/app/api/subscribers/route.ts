import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
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
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const allowedSortFields = ['createdAt', 'plateNumber', 'driverName', 'expirationDate', 'paymentStatus'];
    const resolvedSort = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const resolvedLocationId = resolveLocationId(auth, locationId);

    const where: any = resolvedLocationId ? { locationId: resolvedLocationId } : {};
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (search) {
      where.OR = [
        { plateNumber: { contains: search } },
        { driverName: { contains: search } },
        { phoneNumber: { contains: search } },
        { vehicleType: { contains: search } },
      ];
    }

    const [total, subscribers] = await prisma.$transaction([
      prisma.monthlySubscriber.count({ where }),
      prisma.monthlySubscriber.findMany({
        where,
        orderBy: { [resolvedSort]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: subscribers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error('GET /api/subscribers failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch subscribers.' }, { status: 500 });
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
      driverName,
      phoneNumber,
      vehicleType,
      vehicleColor,
      startDate,
      subscriptionPeriod,
      paymentAmount,
      notes,
      paymentStatus,
      locationId,
    } = body;

    if (!plateNumber || typeof plateNumber !== 'string' || plateNumber.trim() === '') {
      return validationError('plateNumber is required.');
    }
    if (!driverName || typeof driverName !== 'string' || driverName.trim() === '') {
      return validationError('driverName is required.');
    }
    if (!startDate || typeof startDate !== 'string') {
      return validationError('startDate is required.');
    }
    if (!subscriptionPeriod || typeof subscriptionPeriod !== 'number' || subscriptionPeriod < 1) {
      return validationError('subscriptionPeriod must be a positive number (months).');
    }
    if (!locationId || typeof locationId !== 'string') {
      return validationError('locationId is required.');
    }

    const accessError = assertLocationAccess(auth, locationId);
    if (accessError) return accessError;

    const VALID_PAYMENT_STATUSES = ['paid', 'unpaid', 'partial'];
    if (paymentStatus && !VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
      return validationError(`paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`);
    }

    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return validationError('startDate must be a valid date string.');
    }

    const exp = new Date(start);
    exp.setMonth(exp.getMonth() + subscriptionPeriod);
    const remainingDays = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 86400000));
    const ip = getClientIp(req);

    const subscriber = await prisma.monthlySubscriber.create({
      data: {
        plateNumber: plateNumber.trim().toUpperCase(),
        driverName: driverName.trim(),
        phoneNumber: phoneNumber || null,
        vehicleType: vehicleType || null,
        vehicleColor: vehicleColor || null,
        startDate,
        subscriptionPeriod,
        paymentAmount: paymentAmount || 0,
        notes: notes || null,
        expirationDate: exp.toISOString().split('T')[0],
        remainingDays,
        paymentStatus: paymentStatus || 'unpaid',
        locationId,
      },
    });

    await auditLog({
      actor: auth,
      action: `Added subscriber: ${driverName.trim()} (${plateNumber.trim().toUpperCase()})`,
      category: 'subscriber_management',
      locationId,
      newValue: JSON.stringify({ plateNumber: plateNumber.trim().toUpperCase(), driverName: driverName.trim(), subscriptionPeriod }),
      ipAddress: ip,
    });

    return NextResponse.json(subscriber, { status: 201 });
  } catch (error) {
    logger.error('POST /api/subscribers failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create subscriber.' }, { status: 500 });
  }
}
