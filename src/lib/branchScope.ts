/**
 * Shared branch/location scoping helpers.
 * Branch = parking location: users.branchId must equal parking_spaces.locationId, etc.
 */

import { NextResponse } from 'next/server';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { SessionUser } from './apiAuth';

type DbClient = PrismaClient | Prisma.TransactionClient;

export function isBranchScopedUser(auth: Pick<SessionUser, 'role'>): boolean {
  return auth.role === 'branch_admin' || auth.role === 'user_admin';
}

/** Returns 403 if a branch-scoped user has no branch assignment. */
export function requireBranchAssignment(
  auth: Pick<SessionUser, 'role' | 'branchId'>
): NextResponse | null {
  if (isBranchScopedUser(auth) && !auth.branchId) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'Your account is not assigned to a branch.' },
      { status: 403 }
    );
  }
  return null;
}

/** Resolves the location ID used for read filters. Branch users always get their branchId. */
export function resolveLocationId(
  auth: Pick<SessionUser, 'role' | 'branchId'>,
  queryLocationId?: string | null
): string | undefined {
  if (auth.role === 'system_admin') {
    return queryLocationId && queryLocationId !== 'all' ? queryLocationId : undefined;
  }
  if (isBranchScopedUser(auth)) {
    return auth.branchId ?? undefined;
  }
  return undefined;
}

export function resolveLocationWhere(
  auth: Pick<SessionUser, 'role' | 'branchId'>,
  queryLocationId?: string | null
): { locationId?: string } {
  const id = resolveLocationId(auth, queryLocationId);
  return id ? { locationId: id } : {};
}

/** Returns 403 if a branch-scoped user tries to access another branch's data. */
export function assertLocationAccess(
  auth: Pick<SessionUser, 'role' | 'branchId'>,
  locationId: string
): NextResponse | null {
  if (auth.role === 'system_admin') return null;

  if (isBranchScopedUser(auth)) {
    if (!auth.branchId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Your account is not assigned to a branch.' },
        { status: 403 }
      );
    }
    if (auth.branchId !== locationId) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You can only access data in your assigned branch.' },
        { status: 403 }
      );
    }
  }

  return null;
}

export function validateUserBranchAssignment(
  role: string,
  branchId: string | null | undefined
): string | null {
  if (role === 'system_admin') {
    return branchId ? 'system_admin must not be assigned to a branch.' : null;
  }
  if (role === 'branch_admin' || role === 'user_admin') {
    return branchId ? null : `${role} must be assigned to a parking location (branchId).`;
  }
  return 'Invalid role.';
}

export async function validateBranchIdExists(
  prisma: DbClient,
  branchId: string
): Promise<boolean> {
  const count = await prisma.parkingLocation.count({ where: { id: branchId } });
  return count > 0;
}

export function formatSpaceNumber(prefix: string, index: number): string {
  return `${prefix}${String(index).padStart(2, '0')}`;
}

/** Normalizes a user-supplied prefix to a single uppercase letter (A–Z). */
export function normalizeSpacePrefix(prefix: string): string {
  const trimmed = prefix.trim().toUpperCase();
  const letter = trimmed.replace(/[^A-Z]/g, '').charAt(0);
  return letter || 'S';
}

/** Derives a single-letter prefix from a branch name (fallback when prefix not stored). */
export function deriveLocationPrefix(locationName: string): string {
  const trimmed = locationName.trim();
  if (!trimmed) return 'S';

  const parts = trimmed.split(/\s+/);
  const last = parts[parts.length - 1];
  if (last.length === 1 && /[A-Za-z]/.test(last)) {
    return last.toUpperCase();
  }

  const letter = trimmed.replace(/[^A-Za-z]/g, '').charAt(0);
  return (letter || 'S').toUpperCase();
}

function parsePrefixedIndex(spaceNumber: string, prefix: string): number | null {
  const match = spaceNumber.match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
  if (!match) return null;
  const index = parseInt(match[1], 10);
  return Number.isNaN(index) ? null : index;
}

/** Creates missing parking spaces up to capacity for a location. */
export async function ensureLocationSpaces(
  prisma: DbClient,
  locationId: string,
  capacity: number,
  prefix = 'S'
): Promise<number> {
  const existing = await prisma.parkingSpace.findMany({
    where: { locationId },
    select: { spaceNumber: true },
  });

  if (existing.length >= capacity) return 0;

  const prefixUpper = normalizeSpacePrefix(prefix);
  const indices = existing
    .map((space) => parsePrefixedIndex(space.spaceNumber, prefixUpper))
    .filter((index): index is number => index !== null);

  const maxIndex = indices.length > 0 ? Math.max(...indices) : 0;
  const needed = capacity - existing.length;
  const data = [];

  for (let i = 1; i <= needed; i++) {
    data.push({
      spaceNumber: formatSpaceNumber(prefixUpper, maxIndex + i),
      locationId,
      status: 'available' as const,
    });
  }

  if (data.length === 0) return 0;
  await prisma.parkingSpace.createMany({ data });
  return data.length;
}

/** Removes available spaces when capacity decreases. Never deletes occupied spaces. */
export async function trimLocationSpaces(
  prisma: DbClient,
  locationId: string,
  capacity: number
): Promise<number> {
  const spaces = await prisma.parkingSpace.findMany({
    where: { locationId },
    orderBy: { spaceNumber: 'desc' },
  });

  if (spaces.length <= capacity) return 0;

  const occupiedCount = spaces.filter((space) => space.status === 'occupied').length;
  if (occupiedCount > capacity) {
    throw Object.assign(new Error('capacityBelowOccupied'), { code: 'CAPACITY_BELOW_OCCUPIED' });
  }

  let removed = 0;
  let toRemove = spaces.length - capacity;

  for (const space of spaces) {
    if (toRemove <= 0) break;
    if (space.status === 'available') {
      await prisma.parkingSpace.delete({ where: { id: space.id } });
      removed++;
      toRemove--;
    }
  }

  return removed;
}

/** Sync parking spaces when capacity changes (grow or shrink safely). */
export async function reconcileLocationCapacity(
  prisma: DbClient,
  locationId: string,
  capacity: number,
  prefix: string
): Promise<{ added: number; removed: number }> {
  const removed = await trimLocationSpaces(prisma, locationId, capacity);
  const added = await ensureLocationSpaces(prisma, locationId, capacity, prefix);
  return { added, removed };
}
