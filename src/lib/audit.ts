/**
 * Centralized audit logging helper.
 * Every Create, Update, Delete, Login, Logout, Backup, Restore, and Settings change
 * must call one of these helpers to record the event.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import type { UserRole } from '@prisma/client';

export interface AuditActor {
  id: string;
  username: string;
  role: UserRole;
  branchId?: string | null;
}

export interface AuditOptions {
  actor: AuditActor;
  action: string;
  category: AuditCategory;
  locationId?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
}

export type AuditCategory =
  | 'auth' |'vehicle' |'subscriber_management' |'user_management' |'parking_management' |'settings' |'backup_restore';

/**
 * Write an audit log entry. Never throws — failures are logged to stderr only.
 */
export async function auditLog(opts: AuditOptions): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: opts.actor.id,
        username: opts.actor.username,
        userRole: opts.actor.role,
        action: opts.action,
        category: opts.category,
        locationId: opts.locationId ?? null,
        oldValue: opts.oldValue ?? null,
        newValue: opts.newValue ?? null,
        ipAddress: opts.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Never let audit failures break the main request
    logger.error('Failed to write audit log', err, { action: opts.action, actor: opts.actor.username });
  }
}

/**
 * Extract the real client IP from a Next.js request.
 * Checks X-Forwarded-For, X-Real-IP, then falls back to '0.0.0.0'.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '0.0.0.0';
}
