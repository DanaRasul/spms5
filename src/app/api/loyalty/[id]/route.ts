import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireSystemAdmin, isErrorResponse, validationError, notFound } from '@/lib/apiAuth';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

// GET /api/loyalty/[id] — get single loyalty record with logs
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const record = await prisma.customerLoyalty.findUnique({
      where: { id: params.id },
      include: {
        loyaltyLogs: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });
    if (!record) return notFound('Loyalty record');
    return NextResponse.json(record);
  } catch (error) {
    logger.error(`GET /api/loyalty/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch loyalty record.' }, { status: 500 });
  }
}

// PUT /api/loyalty/[id] — update customer info, adjust points, or reset
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { action, customerName, phoneNumber, notes, adjustment, reason } = body;
    const ip = getClientIp(req);

    const record = await prisma.customerLoyalty.findUnique({ where: { id: params.id } });
    if (!record) return notFound('Loyalty record');

    if (action === 'reset') {
      // Only system_admin can reset
      if (auth.role !== 'system_admin') {
        return NextResponse.json({ error: 'Forbidden', message: 'Only System Administrators can reset loyalty records.' }, { status: 403 });
      }

      const updated = await prisma.$transaction(async (tx) => {
        const r = await tx.customerLoyalty.update({
          where: { id: params.id },
          data: { totalVisits: 0, availableRewards: 0 },
        });
        await tx.loyaltyLog.create({
          data: {
            loyaltyId: params.id,
            eventType: 'reset_by_admin',
            description: `Loyalty reset by admin${reason ? ': ' + reason : ''}`,
            visitsBefore: record.totalVisits,
            visitsAfter: 0,
            rewardsBefore: record.availableRewards,
            rewardsAfter: 0,
            performedBy: auth.username,
            performedByRole: auth.role,
            ipAddress: ip,
          },
        });
        return r;
      });

      await auditLog({
        actor: auth,
        action: `Loyalty reset for plate: ${record.licensePlate}${reason ? ' - ' + reason : ''}`,
        category: 'vehicle',
        oldValue: `visits: ${record.totalVisits}, rewards: ${record.availableRewards}`,
        newValue: 'visits: 0, rewards: 0',
        ipAddress: ip,
      });

      return NextResponse.json(updated);
    }

    if (action === 'adjust_visits') {
      if (auth.role !== 'system_admin') {
        return NextResponse.json({ error: 'Forbidden', message: 'Only System Administrators can adjust loyalty points.' }, { status: 403 });
      }
      if (typeof adjustment !== 'number') return validationError('adjustment must be a number.');

      const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
      const visitsRequired = settings?.loyaltyVisitsRequired || 10;

      const updated = await prisma.$transaction(async (tx) => {
        const newVisits = Math.max(0, record.totalVisits + adjustment);
        let newRewards = record.availableRewards;
        let rewardsEarned = record.totalRewardsEarned;

        // Check if threshold crossed
        if (newVisits >= visitsRequired && record.totalVisits < visitsRequired) {
          newRewards += 1;
          rewardsEarned += 1;
        }

        const r = await tx.customerLoyalty.update({
          where: { id: params.id },
          data: { totalVisits: newVisits, availableRewards: newRewards, totalRewardsEarned: rewardsEarned },
        });

        await tx.loyaltyLog.create({
          data: {
            loyaltyId: params.id,
            eventType: adjustment > 0 ? 'points_added' : 'points_removed',
            description: `Manual visit adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}${reason ? ' - ' + reason : ''}`,
            visitsBefore: record.totalVisits,
            visitsAfter: newVisits,
            rewardsBefore: record.availableRewards,
            rewardsAfter: newRewards,
            performedBy: auth.username,
            performedByRole: auth.role,
            ipAddress: ip,
          },
        });
        return r;
      });

      await auditLog({
        actor: auth,
        action: `Loyalty visits adjusted for plate: ${record.licensePlate} (${adjustment > 0 ? '+' : ''}${adjustment})`,
        category: 'vehicle',
        oldValue: `visits: ${record.totalVisits}`,
        newValue: `visits: ${updated.totalVisits}`,
        ipAddress: ip,
      });

      return NextResponse.json(updated);
    }

    if (action === 'adjust_rewards') {
      if (auth.role !== 'system_admin') {
        return NextResponse.json({ error: 'Forbidden', message: 'Only System Administrators can adjust rewards.' }, { status: 403 });
      }
      if (typeof adjustment !== 'number') return validationError('adjustment must be a number.');

      const updated = await prisma.$transaction(async (tx) => {
        let newRewards = Math.max(0, record.availableRewards + adjustment);
        const r = await tx.customerLoyalty.update({
          where: { id: params.id },
          data: { availableRewards: newRewards },
        });
        await tx.loyaltyLog.create({
          data: {
            loyaltyId: params.id,
            eventType: 'manual_adjustment',
            description: `Manual reward adjustment: ${adjustment > 0 ? '+' : ''}${adjustment}${reason ? ' - ' + reason : ''}`,
            visitsBefore: record.totalVisits,
            visitsAfter: record.totalVisits,
            rewardsBefore: record.availableRewards,
            rewardsAfter: newRewards,
            performedBy: auth.username,
            performedByRole: auth.role,
            ipAddress: ip,
          },
        });
        return r;
      });

      return NextResponse.json(updated);
    }

    // Default: update customer info
    const updated = await prisma.customerLoyalty.update({
      where: { id: params.id },
      data: {
        customerName: customerName?.trim() || record.customerName,
        phoneNumber: phoneNumber?.trim() || record.phoneNumber,
        notes: notes !== undefined ? notes?.trim() : record.notes,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error(`PUT /api/loyalty/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update loyalty record.' }, { status: 500 });
  }
}

// DELETE /api/loyalty/[id] — system admin only
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireSystemAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const record = await prisma.customerLoyalty.findUnique({ where: { id: params.id } });
    if (!record) return notFound('Loyalty record');

    await prisma.customerLoyalty.delete({ where: { id: params.id } });

    await auditLog({
      actor: auth,
      action: `Loyalty record deleted for plate: ${record.licensePlate}`,
      category: 'vehicle',
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`DELETE /api/loyalty/${params.id} failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete loyalty record.' }, { status: 500 });
  }
}
