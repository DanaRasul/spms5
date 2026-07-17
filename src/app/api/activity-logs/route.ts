import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { resolveLocationId, requireBranchAssignment, isBranchScopedUser } from '@/lib/branchScope';
import { logger } from '@/lib/logger';

const VALID_CATEGORIES = ['auth', 'vehicle', 'subscriber_management', 'user_management', 'parking_management', 'settings', 'backup_restore'];

export async function GET(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const locationId = searchParams.get('locationId');
    const category = searchParams.get('category');
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(500, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    if (category && !VALID_CATEGORIES.includes(category)) {
      return validationError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    const where: any = {};
    const resolvedLocationId = resolveLocationId(auth, locationId);

    if (resolvedLocationId) {
      if (isBranchScopedUser(auth)) {
        // Strict isolation: a branch_admin/user_admin must NEVER see other
        // branches' or the system_admin's logs, even ones with no locationId.
        where.locationId = resolvedLocationId;
      } else {
        // system_admin explicitly filtering by one location: also include
        // global/unscoped entries (e.g. system-wide settings changes).
        where.OR = [{ locationId: resolvedLocationId }, { locationId: null }];
      }
    }

    if (category) where.category = category;

    if (dateFrom || dateTo) {
      where.timestamp = {};
      if (dateFrom) where.timestamp.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }

    if (search) {
      const searchConditions = [
        { username: { contains: search } },
        { action: { contains: search } },
        { ipAddress: { contains: search } },
      ];
      // Merge with existing OR/AND conditions
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    const [total, logs] = await prisma.$transaction([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { timestamp: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error('GET /api/activity-logs failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch logs.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  try {
    const body = await req.json();
    const { userId, username, userRole, action, category, locationId, oldValue, newValue, ipAddress } = body;

    if (!action || typeof action !== 'string' || action.trim() === '') {
      return validationError('action is required.');
    }
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return validationError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    const log = await prisma.activityLog.create({
      data: {
        userId: userId || auth.id,
        username: username || auth.username,
        userRole: userRole || auth.role,
        action: action.trim(),
        category,
        locationId: locationId || null,
        oldValue: oldValue || null,
        newValue: newValue || null,
        ipAddress: ipAddress || null,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    logger.error('POST /api/activity-logs failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create log.' }, { status: 500 });
  }
}
