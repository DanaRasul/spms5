import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole, isErrorResponse, notFound, validationError } from '@/lib/apiAuth';
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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['system_admin', 'branch_admin']);
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { id } = await params;
    const body = await req.json();
    const { password, ...data } = body;
    const ip = getClientIp(req);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return notFound('User');

    if (auth.role === 'branch_admin') {
      if (existing.branchId !== auth.branchId || existing.role !== 'user_admin') {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You can only manage operators in your assigned branch.' },
          { status: 403 }
        );
      }
      if (data.role && data.role !== 'user_admin') {
        return validationError('branch_admin can only manage user_admin accounts.');
      }
      if (data.branchId && data.branchId !== auth.branchId) {
        return validationError('Cannot reassign users to a different branch.');
      }
      data.role = 'user_admin';
      data.branchId = auth.branchId;
    }

    if (data.email !== undefined) {
      if (typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        return validationError('A valid email address is required.');
      }
      data.email = data.email.trim().toLowerCase();
    }
    if (data.role !== undefined && !VALID_ROLES.includes(data.role)) {
      return validationError(`role must be one of: ${VALID_ROLES.join(', ')}`);
    }
    if (data.username !== undefined) {
      if (typeof data.username !== 'string' || data.username.trim() === '') {
        return validationError('username cannot be empty.');
      }
      data.username = data.username.trim();
    }
    if (data.fullName !== undefined) {
      if (typeof data.fullName !== 'string' || data.fullName.trim() === '') {
        return validationError('fullName cannot be empty.');
      }
      data.fullName = data.fullName.trim();
    }

    const nextRole = data.role ?? existing.role;
    const nextBranchId = data.branchId !== undefined ? data.branchId : existing.branchId;
    const branchError = validateUserBranchAssignment(nextRole, nextBranchId);
    if (branchError) return validationError(branchError);

    if (nextBranchId && !(await validateBranchIdExists(prisma, nextBranchId))) {
      return validationError('branchId must reference an existing parking location.');
    }

    const updateData: any = { ...data };
    if (password) {
      if (typeof password !== 'string' || password.length < 6) {
        return validationError('password must be at least 6 characters.');
      }
      updateData.password = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    const changedFields: string[] = [];
    for (const key of Object.keys(data)) {
      if (key !== 'password' && (existing as any)[key] !== data[key]) {
        changedFields.push(key);
      }
    }
    if (password) changedFields.push('password');

    await auditLog({
      actor: auth,
      action: `Updated user: ${existing.username}${changedFields.length ? ` (changed: ${changedFields.join(', ')})` : ''}`,
      category: 'user_management',
      locationId: user.branchId,
      oldValue: JSON.stringify({ username: existing.username, role: existing.role, enabled: existing.enabled }),
      newValue: JSON.stringify({ username: user.username, role: user.role, enabled: user.enabled }),
      ipAddress: ip,
    });

    return NextResponse.json(user);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Conflict', message: 'Username or email already exists.' },
        { status: 409 }
      );
    }
    logger.error(`PUT /api/users/[id] failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update user.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['system_admin', 'branch_admin']);
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  try {
    const { id } = await params;
    const ip = getClientIp(req);

    if (id === auth.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You cannot delete your own account.' },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return notFound('User');

    if (auth.role === 'branch_admin') {
      if (user.branchId !== auth.branchId || user.role !== 'user_admin') {
        return NextResponse.json(
          { error: 'Forbidden', message: 'You can only delete operators in your assigned branch.' },
          { status: 403 }
        );
      }
    }

    // Historical audit logs must never be deleted. activity_logs.userId is
    // nullable with ON DELETE SET NULL at the DB level (see migration
    // 20260715090000_activity_log_user_setnull), so this would succeed even
    // without the explicit update below — but we do it explicitly too, in
    // the same transaction, so the intent is clear and it's correct even if
    // this ever runs against a DB where that migration hasn't been applied yet.
    await prisma.$transaction([
      prisma.activityLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);

    await auditLog({
      actor: auth,
      action: `Deleted user: ${user.username} (role: ${user.role})`,
      category: 'user_management',
      locationId: user.branchId,
      oldValue: JSON.stringify({ username: user.username, role: user.role, email: user.email }),
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(`DELETE /api/users/[id] failed`, error);
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to delete user.' }, { status: 500 });
  }
}
