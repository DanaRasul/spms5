import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/apiAuth';
import { resolveLocationId, requireBranchAssignment } from '@/lib/branchScope';
import { logger } from '@/lib/logger';

const vehicleStatsSelect = {
  id: true,
  status: true,
  entryDate: true,
  exitDate: true,
  fee: true,
  loyaltyRewardUsed: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');

    const todayStr = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

    const resolvedLocationId = resolveLocationId(auth, locationId);

    const vehicleWhere = resolvedLocationId ? { locationId: resolvedLocationId } : {};
    const spaceWhere = resolvedLocationId ? { locationId: resolvedLocationId } : {};
    const subWhere = resolvedLocationId ? { locationId: resolvedLocationId } : {};

    const [allVehicles, allSpaces, allSubscribers] = await Promise.all([
      prisma.vehicleRecord.findMany({ where: vehicleWhere, select: vehicleStatsSelect }),
      prisma.parkingSpace.findMany({ where: spaceWhere, select: { id: true, status: true } }),
      prisma.monthlySubscriber.findMany({ where: subWhere, select: { id: true } }),
    ]);

    const inside = allVehicles.filter((v) => v.status === 'inside');
    const completed = allVehicles.filter((v) => v.status === 'completed');

    const todayRev = completed.filter((v) => v.exitDate === todayStr).reduce((a, v) => a + (v.fee || 0), 0);
    const weeklyRev = completed.filter((v) => v.exitDate && v.exitDate >= weekAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const monthlyRev = completed.filter((v) => v.exitDate && v.exitDate >= monthAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const annualRev = completed.filter((v) => v.exitDate && v.exitDate >= yearAgo).reduce((a, v) => a + (v.fee || 0), 0);
    const totalRev = completed.reduce((a, v) => a + (v.fee || 0), 0);

    const totalSpaces = allSpaces.length;
    const occupiedSpaces = allSpaces.filter((s) => s.status === 'occupied').length;
    const availableSpaces = allSpaces.filter((s) => s.status === 'available').length;
    const occupancyPercentage = totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;

    let loyaltyMembers = 0;
    let returningCustomers = 0;
    let rewardsEarnedToday = 0;
    let rewardsRedeemedToday = 0;

    try {
      const [loyaltyStats, loyaltyTodayLogs] = await Promise.all([
        prisma.customerLoyalty.aggregate({
          _count: { id: true },
        }),
        prisma.loyaltyLog.findMany({
          where: { timestamp: { gte: todayStart } },
          select: { eventType: true },
        }),
      ]);

      loyaltyMembers = loyaltyStats._count.id;
      returningCustomers = await prisma.customerLoyalty.count({ where: { totalVisits: { gt: 1 } } });
      rewardsEarnedToday = loyaltyTodayLogs.filter((l) => l.eventType === 'reward_earned').length;
      rewardsRedeemedToday = loyaltyTodayLogs.filter((l) => l.eventType === 'reward_redeemed').length;
    } catch (loyaltyError) {
      logger.warn('Dashboard loyalty stats unavailable', { error: loyaltyError });
    }

    const freeParkingToday = allVehicles.filter(
      (v) => v.exitDate === todayStr && v.loyaltyRewardUsed
    ).length;

    return NextResponse.json({
      vehiclesInside: inside.length,
      todayVehicles: allVehicles.filter((v) => v.entryDate === todayStr).length,
      weeklyVehicles: allVehicles.filter((v) => v.entryDate >= weekAgo).length,
      monthlyVehicles: allVehicles.filter((v) => v.entryDate >= monthAgo).length,
      annualVehicles: allVehicles.filter((v) => v.entryDate >= yearAgo).length,
      todayRevenue: todayRev,
      weeklyRevenue: weeklyRev,
      monthlyRevenue: monthlyRev,
      annualRevenue: annualRev,
      totalRevenue: totalRev,
      monthlySubscribers: allSubscribers.length,
      totalSpaces,
      availableSpaces,
      occupiedSpaces,
      occupancyPercentage,
      loyaltyMembers,
      returningCustomers,
      rewardsEarnedToday,
      rewardsRedeemedToday,
      freeParkingToday,
    });
  } catch (error) {
    logger.error('GET /api/dashboard failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch dashboard stats.' }, { status: 500 });
  }
}
