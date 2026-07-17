/**
 * Shared API authentication & authorization helpers.
 * Every protected API route must call requireAuth() or requireRole() first.
 */

import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export type UserRole = 'system_admin' | 'branch_admin' | 'user_admin';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  branchId: string | null;
  enabled: boolean;
}

/** Returns the session user or a 401 NextResponse. */
export async function requireAuth(): Promise<SessionUser | NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required.' },
      { status: 401 }
    );
  }
  return session.user as SessionUser;
}

/**
 * Returns the session user if their role is in `allowedRoles`,
 * otherwise returns a 401/403 NextResponse.
 */
export async function requireRole(
  allowedRoles: UserRole[]
): Promise<SessionUser | NextResponse> {
  const result = await requireAuth();
  if (result instanceof NextResponse) return result;

  if (!allowedRoles.includes(result.role)) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'You do not have permission to perform this action.' },
      { status: 403 }
    );
  }
  return result;
}

/** Convenience: only system_admin may call this endpoint. */
export const requireSystemAdmin = () => requireRole(['system_admin']);

/** Convenience: system_admin or branch_admin. */
export const requireAdmin = () => requireRole(['system_admin', 'branch_admin']);

/** Convenience: any authenticated user. */
export const requireAnyRole = () => requireRole(['system_admin', 'branch_admin', 'user_admin']);

/** Type-guard: is the value a NextResponse (i.e. an error was returned)? */
export function isErrorResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

/** Standard 400 validation error response. */
export function validationError(message: string): NextResponse {
  return NextResponse.json({ error: 'Validation Error', message }, { status: 400 });
}

/** Standard 404 not-found response. */
export function notFound(resource: string): NextResponse {
  return NextResponse.json({ error: 'Not Found', message: `${resource} not found.` }, { status: 404 });
}

/** Standard 500 internal error response — never exposes stack traces. */
export function internalError(message = 'An unexpected error occurred. Please try again later.'): NextResponse {
  return NextResponse.json({ error: 'Internal Server Error', message }, { status: 500 });
}
