import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';

function minutesBetween(entryDate: string, entryTime: string, exitDate: string, exitTime: string): number {
  const entry = new Date(`${entryDate}T${entryTime}`);
  const exit = new Date(`${exitDate}T${exitTime}`);
  const diff = Math.round((exit.getTime() - entry.getTime()) / 60000);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function formatMinutes(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  let out = '';
  if (days > 0) out += `${days}d `;
  if (hours > 0 || days > 0) out += `${hours}h `;
  out += `${mins}m`;
  return out.trim();
}

// GET /api/loyalty/profile?plate=ABC123
// Combines the customer's loyalty record + loyalty activity log + their full
// parking history (across all branches) + computed statistics, in one call,
// keyed by an exact plate match. Read-only; does not modify existing tables.
export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const plateParam = searchParams.get('plate');
    if (!plateParam || !plateParam.trim()) {
      return validationError('plate parameter is required.');
    }
    const plate = plateParam.trim().toUpperCase();

    const [loyalty, records, settings] = await Promise.all([
      prisma.customerLoyalty.findUnique({
        where: { licensePlate: plate },
        include: { loyaltyLogs: { orderBy: { timestamp: 'desc' }, take: 100 } },
      }),
      prisma.vehicleRecord.findMany({
        where: { plateNumber: plate },
        orderBy: [{ entryDate: 'desc' }, { entryTime: 'desc' }],
        select: {
          entryDate: true, entryTime: true, exitDate: true, exitTime: true,
          duration: true, fee: true, status: true, parkingSpaceNumber: true,
          locationId: true, driverName: true, vehicleType: true, vehicleColor: true,
        },
      }),
      prisma.systemSettings.findUnique({ where: { id: 'default' } }),
    ]);

    if (!loyalty && records.length === 0) {
      return NextResponse.json({ error: 'Not Found', message: 'No customer found for this plate number.' }, { status: 404 });
    }

    const locationIds = Array.from(new Set(records.map(r => r.locationId).filter(Boolean)));
    const locations = locationIds.length
      ? await prisma.parkingLocation.findMany({ where: { id: { in: locationIds } }, select: { id: true, name: true } })
      : [];
    const locationNameById = new Map(locations.map(l => [l.id, l.name]));

    const completed = records.filter(r => r.status === 'completed' && r.exitDate && r.exitTime);
    const totalRevenue = completed.reduce((sum, r) => sum + (r.fee || 0), 0);
    const totalParkingMinutes = completed.reduce(
      (sum, r) => sum + minutesBetween(r.entryDate, r.entryTime, r.exitDate as string, r.exitTime as string),
      0
    );
    const avgDurationMinutes = completed.length ? Math.round(totalParkingMinutes / completed.length) : 0;

    const latestRecord = records[0];
    const visitsRequired = settings?.loyaltyVisitsRequired || 10;
    const totalVisits = loyalty?.totalVisits ?? records.length;
    const remainingVisits = visitsRequired - (totalVisits % visitsRequired);

    const loyaltyLogs = loyalty?.loyaltyLogs || [];
    const earnedVisits = loyaltyLogs.filter(l => l.eventType === 'visit_added').length;
    const redeemedRewards = loyaltyLogs.filter(l => l.eventType === 'reward_redeemed').length;

    return NextResponse.json({
      customer: {
        plateNumber: plate,
        driverName: loyalty?.customerName || latestRecord?.driverName || null,
        phoneNumber: loyalty?.phoneNumber || null,
        vehicleType: latestRecord?.vehicleType || null,
        vehicleColor: latestRecord?.vehicleColor || null,
      },
      loyalty: {
        enabled: settings?.loyaltyEnabled ?? true,
        totalVisits,
        availableRewards: loyalty?.availableRewards || 0,
        totalRewardsEarned: loyalty?.totalRewardsEarned || 0,
        totalRewardsRedeemed: loyalty?.totalRewardsRedeemed || 0,
        remainingVisits,
        visitsRequired,
        lastVisit: loyalty?.lastVisit || null,
      },
      stats: {
        totalVisits: records.length,
        totalRevenue,
        totalParkingMinutes,
        totalParkingHoursLabel: formatMinutes(totalParkingMinutes),
        avgDurationMinutes,
        avgDurationLabel: formatMinutes(avgDurationMinutes),
      },
      history: records.map(r => ({
        entryDate: r.entryDate,
        entryTime: r.entryTime,
        exitDate: r.exitDate,
        exitTime: r.exitTime,
        duration: r.duration,
        fee: r.fee,
        status: r.status,
        parkingSpaceNumber: r.parkingSpaceNumber,
        locationName: r.locationId ? locationNameById.get(r.locationId) || null : null,
      })),
      loyaltyActivity: loyaltyLogs.map(l => ({
        eventType: l.eventType,
        description: l.description,
        visitsBefore: l.visitsBefore,
        visitsAfter: l.visitsAfter,
        rewardsBefore: l.rewardsBefore,
        rewardsAfter: l.rewardsAfter,
        timestamp: l.timestamp,
      })),
      loyaltySummary: { earnedVisits, redeemedRewards },
      currency: settings?.currency || 'IQD',
    });
  } catch (error) {
    logger.error('GET /api/loyalty/profile failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch customer profile.' }, { status: 500 });
  }
}
