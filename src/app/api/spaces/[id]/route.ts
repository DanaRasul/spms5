import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isErrorResponse, notFound, validationError } from '@/lib/apiAuth';
import { assertLocationAccess, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

const VALID_STATUSES = ['available', 'occupied'];

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const body = await req.json();
    const ip = getClientIp(req);

    const existing = await prisma.parkingSpace.findUnique({ where: { id: params.id } });
    if (!existing) return notFound('Parking space');

    const accessError = assertLocationAccess(auth, existing.locationId);
    if (accessError) return accessError;

    if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
      return validationError(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const allowedFields = ['spaceNumber', 'status'];
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    if (Object.keys(updateData).length === 0) {
      return validationError('No valid fields provided for update.');
    }

    const space = await prisma.parkingSpace.update({
      where: { id: params.id },
      data: updateData,
    });

    await auditLog({
      actor: auth,
      action: `Updated parking space: ${existing.spaceNumber}`,
      category: 'parking_management',
      locationId: existing.locationId,
      oldValue: JSON.stringify({ spaceNumber: existing.spaceNumber, status: existing.status }),
      newValue: JSON.stringify(updateData),
      ipAddress: ip,
    });

    return NextResponse.json(space);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Space number already exists in this location.' },
        { status: 409 }
      );
    }
    logger.error(`PUT /api/spaces/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update space.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const ip = getClientIp(req);

    const existing = await prisma.parkingSpace.findUnique({ where: { id: params.id } });
    if (!existing) return notFound('Parking space');

    const accessError = assertLocationAccess(auth, existing.locationId);
    if (accessError) return accessError;

    if (existing.status === 'occupied') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Cannot delete an occupied parking space.' },
        { status: 409 }
      );
    }

    await prisma.parkingSpace.delete({ where: { id: params.id } });

    await auditLog({
      actor: auth,
      action: `Deleted parking space: ${existing.spaceNumber}`,
      category: 'parking_management',
      locationId: existing.locationId,
      oldValue: JSON.stringify({ spaceNumber: existing.spaceNumber, status: existing.status }),
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`DELETE /api/spaces/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete space.' }, { status: 500 });
  }
}
