import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, requireAdmin, isErrorResponse, validationError } from '@/lib/apiAuth';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

// GET /api/loyalty — list all loyalty members with pagination/search
export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'totalVisits';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const filter = searchParams.get('filter') || 'all'; // all | has_rewards | near_reward

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    const visitsRequired = settings?.loyaltyVisitsRequired || 10;

    const where: any = {};
    if (search) {
      where.OR = [
        { licensePlate: { contains: search } },
        { customerName: { contains: search } },
        { phoneNumber: { contains: search } },
      ];
    }
    if (filter === 'has_rewards') {
      where.availableRewards = { gt: 0 };
    } else if (filter === 'near_reward') {
      where.totalVisits = { gte: visitsRequired - 2 };
    }

    const [total, data] = await Promise.all([
      prisma.customerLoyalty.count({ where }),
      prisma.customerLoyalty.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      visitsRequired,
    });
  } catch (error) {
    logger.error('GET /api/loyalty failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch loyalty data.' }, { status: 500 });
  }
}

// POST /api/loyalty — create or update loyalty record manually
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { licensePlate, customerName, phoneNumber, notes } = body;
    const ip = getClientIp(req);

    if (!licensePlate?.trim()) return validationError('License plate is required.');

    const existing = await prisma.customerLoyalty.findUnique({ where: { licensePlate: licensePlate.trim().toUpperCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Conflict', message: 'Loyalty record already exists for this license plate.' }, { status: 409 });
    }

    const record = await prisma.customerLoyalty.create({
      data: {
        licensePlate: licensePlate.trim().toUpperCase(),
        customerName: customerName?.trim() || null,
        phoneNumber: phoneNumber?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    await auditLog({
      actor: auth,
      action: `Loyalty record created for plate: ${record.licensePlate}`,
      category: 'vehicle',
      ipAddress: ip,
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    logger.error('POST /api/loyalty failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create loyalty record.' }, { status: 500 });
  }
}
