import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/apiAuth';
import { resolveLocationId, requireBranchAssignment } from '@/lib/branchScope';
import { logger } from '@/lib/logger';

interface PlateStats {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  overall: number;
}

function toDateOnlyString(d: Date): string {
  return d.toISOString().split('T')[0];
}

// GET /api/subscribers/stats
// Returns { [plateNumber]: { today, thisWeek, thisMonth, thisYear, overall } }
// for every current monthly subscriber, aggregated from VehicleRecord (the
// existing Parking History) — no vehicle data is duplicated or stored here.
export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');
    const resolvedLocationId = resolveLocationId(auth, locationId);

    const subscriberWhere: any = resolvedLocationId ? { locationId: resolvedLocationId } : {};
    const subscribers = await prisma.monthlySubscriber.findMany({
      where: subscriberWhere,
      select: { plateNumber: true },
    });
    const plates = Array.from(new Set(subscribers.map(s => s.plateNumber)));

    if (plates.length === 0) {
      return NextResponse.json({ data: {} });
    }

    const vehicleWhere: any = {
      plateNumber: { in: plates },
      status: 'completed',
    };
    if (resolvedLocationId) vehicleWhere.locationId = resolvedLocationId;

    const records = await prisma.vehicleRecord.findMany({
      where: vehicleWhere,
      select: { plateNumber: true, entryDate: true },
    });

    const now = new Date();
    const todayStr = toDateOnlyString(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    const weekAgoStr = toDateOnlyString(weekAgo);
    const monthPrefix = todayStr.slice(0, 7); // YYYY-MM
    const yearPrefix = todayStr.slice(0, 4); // YYYY

    const stats: Record<string, PlateStats> = {};
    for (const plate of plates) {
      stats[plate] = { today: 0, thisWeek: 0, thisMonth: 0, thisYear: 0, overall: 0 };
    }

    for (const r of records) {
      const s = stats[r.plateNumber];
      if (!s) continue;
      s.overall += 1;
      if (r.entryDate === todayStr) s.today += 1;
      if (r.entryDate >= weekAgoStr && r.entryDate <= todayStr) s.thisWeek += 1;
      if (r.entryDate.startsWith(monthPrefix)) s.thisMonth += 1;
      if (r.entryDate.startsWith(yearPrefix)) s.thisYear += 1;
    }

    return NextResponse.json({ data: stats });
  } catch (error) {
    logger.error('GET /api/subscribers/stats failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch subscriber statistics.' }, { status: 500 });
  }
}
