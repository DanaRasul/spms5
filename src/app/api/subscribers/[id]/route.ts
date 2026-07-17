import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, notFound, validationError } from '@/lib/apiAuth';
import { assertLocationAccess, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const body = await req.json();
    const { ...data } = body;
    const ip = getClientIp(req);

    const existing = await prisma.monthlySubscriber.findUnique({ where: { id: params.id } });
    if (!existing) return notFound('Subscriber');

    const accessError = assertLocationAccess(auth, existing.locationId);
    if (accessError) return accessError;

    const VALID_PAYMENT_STATUSES = ['paid', 'unpaid', 'partial'];
    if (data.paymentStatus && !VALID_PAYMENT_STATUSES.includes(data.paymentStatus)) {
      return validationError(`paymentStatus must be one of: ${VALID_PAYMENT_STATUSES.join(', ')}`);
    }

    if (data.startDate || data.subscriptionPeriod) {
      const start = new Date(data.startDate || existing.startDate);
      if (isNaN(start.getTime())) {
        return validationError('startDate must be a valid date string.');
      }
      const period = data.subscriptionPeriod || existing.subscriptionPeriod;
      if (typeof period !== 'number' || period < 1) {
        return validationError('subscriptionPeriod must be a positive number.');
      }
      const exp = new Date(start);
      exp.setMonth(exp.getMonth() + period);
      data.expirationDate = exp.toISOString().split('T')[0];
      data.remainingDays = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 86400000));
    }

    const subscriber = await prisma.monthlySubscriber.update({
      where: { id: params.id },
      data,
    });

    await auditLog({
      actor: auth,
      action: `Updated subscriber: ${existing.driverName} (${existing.plateNumber})`,
      category: 'subscriber_management',
      locationId: existing.locationId,
      oldValue: JSON.stringify({ paymentStatus: existing.paymentStatus, subscriptionPeriod: existing.subscriptionPeriod }),
      newValue: JSON.stringify({ paymentStatus: subscriber.paymentStatus, subscriptionPeriod: subscriber.subscriptionPeriod }),
      ipAddress: ip,
    });

    return NextResponse.json(subscriber);
  } catch (error) {
    logger.error(`PUT /api/subscribers/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update subscriber.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const ip = getClientIp(req);

    const sub = await prisma.monthlySubscriber.findUnique({ where: { id: params.id } });
    if (!sub) return notFound('Subscriber');

    const accessError = assertLocationAccess(auth, sub.locationId);
    if (accessError) return accessError;

    await prisma.monthlySubscriber.delete({ where: { id: params.id } });

    await auditLog({
      actor: auth,
      action: `Deleted subscriber: ${sub.driverName} (${sub.plateNumber})`,
      category: 'subscriber_management',
      locationId: sub.locationId,
      oldValue: JSON.stringify({ plateNumber: sub.plateNumber, driverName: sub.driverName }),
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`DELETE /api/subscribers/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete subscriber.' }, { status: 500 });
  }
}
