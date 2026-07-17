import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        ipAddress: { label: 'IP', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const ip = credentials.ipAddress || '0.0.0.0';

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.enabled) {
          // Audit failed login attempt for unknown user (no userId available)
          logger.warn('Login attempt for unknown/disabled user', { username: credentials.username, ip });
          return null;
        }

        // Check account lockout
        const recentFailed = await prisma.failedLogin.findMany({
          where: {
            userId: user.id,
            attemptedAt: { gte: new Date(Date.now() - LOCKOUT_DURATION_MS) },
          },
          orderBy: { attemptedAt: 'desc' },
        });

        if (recentFailed.length >= MAX_FAILED_ATTEMPTS) {
          // Audit locked account attempt
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              username: user.username,
              userRole: user.role,
              action: 'Login attempt on locked account',
              category: 'auth',
              ipAddress: ip,
              locationId: user.branchId,
            },
          }).catch((e) => logger.error('Failed to write lockout audit log', e));
          throw new Error('ACCOUNT_LOCKED');
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password);

        if (!passwordMatch) {
          await prisma.failedLogin.create({
            data: { userId: user.id },
          });

          // Audit failed login
          await prisma.activityLog.create({
            data: {
              userId: user.id,
              username: user.username,
              userRole: user.role,
              action: 'Failed login attempt (wrong password)',
              category: 'auth',
              ipAddress: ip,
              locationId: user.branchId,
            },
          }).catch((e) => logger.error('Failed to write failed-login audit log', e));

          return null;
        }

        // Clear failed login attempts on success
        await prisma.failedLogin.deleteMany({
          where: { userId: user.id },
        });

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        // Audit successful login
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            username: user.username,
            userRole: user.role,
            action: 'User logged in successfully',
            category: 'auth',
            ipAddress: ip,
            locationId: user.branchId,
          },
        }).catch((e) => logger.error('Failed to write login audit log', e));

        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          branchId: user.branchId,
          enabled: user.enabled,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.fullName = (user as any).fullName;
        token.role = (user as any).role;
        token.branchId = (user as any).branchId;
        token.enabled = (user as any).enabled;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          username: token.username as string,
          fullName: token.fullName as string,
          email: token.email as string,
          role: token.role as string,
          branchId: token.branchId as string | null,
          enabled: token.enabled as boolean,
        } as any;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await prisma.activityLog.create({
          data: {
            userId: token.id as string,
            username: (token.username as string) || 'unknown',
            userRole: (token.role as any) || 'user_admin',
            action: 'User logged out',
            category: 'auth',
            ipAddress: '0.0.0.0', // IP not available in signOut event
            locationId: (token.branchId as string) || null,
          },
        }).catch((e) => logger.error('Failed to write logout audit log', e));
      }
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
