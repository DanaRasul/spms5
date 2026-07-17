import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse } from '@/lib/apiAuth';
import { logger } from '@/lib/logger';

// GET /api/loyalty/lookup?plate=ABC123 — quick lookup by plate for vehicle entry/exit
export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const plate = searchParams.get('plate');
    if (!plate) {
      return NextResponse.json({ error: 'Validation Error', message: 'plate parameter is required.' }, { status: 400 });
    }

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    const visitsRequired = settings?.loyaltyVisitsRequired || 10;
    const loyaltyEnabled = settings?.loyaltyEnabled ?? true;

    if (!loyaltyEnabled) {
      return NextResponse.json({ enabled: false, loyalty: null, visitsRequired });
    }

    const loyalty = await prisma.customerLoyalty.findUnique({
      where: { licensePlate: plate.trim().toUpperCase() },
    });

    return NextResponse.json({ enabled: true, loyalty, visitsRequired });
  } catch (error) {
    logger.error('GET /api/loyalty/lookup failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to lookup loyalty.' }, { status: 500 });
  }
}
