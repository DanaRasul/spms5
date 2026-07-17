import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSystemAdmin, requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

export async function GET() {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  try {
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      const defaultSettings = await prisma.systemSettings.create({
        data: {
          id: 'default',
          totalCapacity: 50,
          hourlyRate1: 1000,
          hourlyRate2: 1500,
          hourlyRate3: 2000,
          currency: 'IQD',
          timezone: 'Asia/Baghdad',
        },
      });
      return NextResponse.json(defaultSettings);
    }
    return NextResponse.json(settings);
  } catch (error) {
    logger.error('GET /api/settings failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch settings.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSystemAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const ip = getClientIp(req);
    const { ...data } = body;

    const numericFields = ['totalCapacity', 'hourlyRate1', 'hourlyRate2', 'hourlyRate3'];
    for (const field of numericFields) {
      if (data[field] !== undefined) {
        if (typeof data[field] !== 'number' || data[field] < 0) {
          return validationError(`${field} must be a non-negative number.`);
        }
      }
    }

    const allowedFields = [
      'totalCapacity', 'hourlyRate1', 'hourlyRate2', 'hourlyRate3', 'currency', 'timezone', 'parkingName', 'address', 'phoneNumber',
      // Loyalty settings
      'loyaltyEnabled', 'loyaltyVisitsRequired', 'loyaltyRewardType', 'loyaltyDiscountPercent',
      'loyaltyFixedDiscount', 'loyaltyRewardExpireDays', 'loyaltyIncludeSubscribers',
    ];
    const safeData: any = {};
    for (const field of allowedFields) {
      if (data[field] !== undefined) safeData[field] = data[field];
    }

    if (Object.keys(safeData).length === 0) {
      return validationError('No valid settings fields provided.');
    }

    // Capture old values for audit
    const oldSettings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'default' },
      update: safeData,
      create: { id: 'default', ...safeData },
    });

    await auditLog({
      actor: auth,
      action: `System settings updated: ${Object.keys(safeData).join(', ')}`,
      category: 'settings',
      oldValue: oldSettings ? JSON.stringify(
        Object.fromEntries(Object.keys(safeData).map(k => [k, (oldSettings as any)[k]]))
      ) : null,
      newValue: JSON.stringify(safeData),
      ipAddress: ip,
    });

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('PUT /api/settings failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update settings.' }, { status: 500 });
  }
}
