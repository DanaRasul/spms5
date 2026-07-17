import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, isErrorResponse } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';

// GET /api/loyalty/reports — loyalty reports with period filtering
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get('period') || 'daily'; // daily|weekly|monthly|yearly
    const reportType = searchParams.get('type') || 'activity'; // activity|top50|near_reward|rewards_issued|rewards_redeemed

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    const visitsRequired = settings?.loyaltyVisitsRequired || 10;

    const now = new Date();
    let dateFrom: Date;

    if (period === 'daily') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      dateFrom = new Date(now.getTime() - 7 * 86400000);
    } else if (period === 'monthly') {
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      dateFrom = new Date(now.getFullYear(), 0, 1);
    }

    if (reportType === 'top50') {
      const data = await prisma.customerLoyalty.findMany({
        orderBy: { totalVisits: 'desc' },
        take: 50,
      });
      return NextResponse.json({ data, period, reportType });
    }

    if (reportType === 'near_reward') {
      const data = await prisma.customerLoyalty.findMany({
        where: {
          totalVisits: { gte: visitsRequired - 2, lt: visitsRequired },
          availableRewards: 0,
        },
        orderBy: { totalVisits: 'desc' },
      });
      return NextResponse.json({ data, period, reportType, visitsRequired });
    }

    // Activity / rewards_issued / rewards_redeemed — filter by loyalty logs
    const eventTypeFilter: any = {};
    if (reportType === 'rewards_issued') {
      eventTypeFilter.eventType = 'reward_earned';
    } else if (reportType === 'rewards_redeemed') {
      eventTypeFilter.eventType = 'reward_redeemed';
    }

    const logs = await prisma.loyaltyLog.findMany({
      where: {
        timestamp: { gte: dateFrom },
        ...eventTypeFilter,
      },
      include: {
        loyalty: {
          select: { licensePlate: true, customerName: true, phoneNumber: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    // Summary stats
    const allLogs = await prisma.loyaltyLog.findMany({
      where: { timestamp: { gte: dateFrom } },
    });

    const summary = {
      visitsAdded: allLogs.filter(l => l.eventType === 'visit_added').length,
      rewardsEarned: allLogs.filter(l => l.eventType === 'reward_earned').length,
      rewardsRedeemed: allLogs.filter(l => l.eventType === 'reward_redeemed').length,
      manualAdjustments: allLogs.filter(l => l.eventType === 'manual_adjustment' || l.eventType === 'points_added' || l.eventType === 'points_removed').length,
    };

    return NextResponse.json({ data: logs, summary, period, reportType });
  } catch (error) {
    logger.error('GET /api/loyalty/reports failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch loyalty reports.' }, { status: 500 });
  }
}
