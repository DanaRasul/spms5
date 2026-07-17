import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole, isErrorResponse, validationError } from '@/lib/apiAuth';
import { validateUserBranchAssignment, validateBranchIdExists, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logger } from '@/lib/logger';

const VALID_ROLES = ['system_admin', 'branch_admin', 'user_admin'];

const userSelect = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  role: true,
  enabled: true,
  branchId: true,
  createdAt: true,
  lastLogin: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await requireRole(['system_admin', 'branch_admin']);
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const role = searchParams.get('role');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10)));
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    const allowedSortFields = ['createdAt', 'username', 'fullName', 'role', 'lastLogin'];
    const resolvedSort = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

    const where: any = {};

    if (auth.role === 'branch_admin') {
      where.branchId = auth.branchId;
      where.role = 'user_admin';
    } else {
      if (branchId) where.branchId = branchId;
      if (role) {
        if (!VALID_ROLES.includes(role)) {
          return validationError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
        }
        where.role = role;
      }
    }

    if (enabled !== null && enabled !== undefined && enabled !== '') {
      where.enabled = enabled === 'true';
    }
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { fullName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { [resolvedSort]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      data: users,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    logger.error('GET /api/users failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to fetch users.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['system_admin', 'branch_admin']);
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const body = await req.json();
    let { username, fullName, email, password, role, branchId, enabled } = body;
    const ip = getClientIp(req);

    if (auth.role === 'branch_admin') {
      role = 'user_admin';
      branchId = auth.branchId;
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return validationError('username is required.');
    }
    if (!fullName || typeof fullName !== 'string' || fullName.trim() === '') {
      return validationError('fullName is required.');
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return validationError('A valid email address is required.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return validationError('password must be at least 6 characters.');
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return validationError(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    const branchError = validateUserBranchAssignment(role, branchId);
    if (branchError) return validationError(branchError);

    if (branchId && !(await validateBranchIdExists(prisma, branchId))) {
      return validationError('branchId must reference an existing parking location.');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: hashedPassword,
        role,
        branchId: branchId || null,
        enabled: enabled !== false,
      },
      select: userSelect,
    });

    await auditLog({
      actor: auth,
      action: `Created user: ${username.trim()} (role: ${role})`,
      category: 'user_management',
      locationId: branchId || null,
      newValue: JSON.stringify({ username: username.trim(), role, branchId: branchId || null }),
      ipAddress: ip,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Username or email already exists.' },
        { status: 409 }
      );
    }
    logger.error('POST /api/users failed', error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to create user.' }, { status: 500 });
  }
}
