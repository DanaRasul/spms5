import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { LoyaltyEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAnyRole, isErrorResponse, notFound } from '@/lib/apiAuth';
import { assertLocationAccess, requireBranchAssignment } from '@/lib/branchScope';
import { auditLog, getClientIp } from '@/lib/audit';
import { logApiError, mapPrismaError } from '@/lib/logger';

const TX_OPTIONS = { maxWait: 5000, timeout: 10000 } as const;

const EDITABLE_FIELDS = ['plateNumber', 'parkingSpaceNumber', 'vehicleType', 'vehicleColor', 'driverName'] as const;
type EditableField = (typeof EDITABLE_FIELDS)[number];

function plateLockKey(plate: string): string {
  return `spms_plate_${plate}`;
}

function generateReceiptNumber(now: Date): string {
  const datePart = now.toISOString().split('T')[0].replace(/-/g, '');
  const randomPart = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `R${datePart}-${randomPart}`;
}

async function acquireNamedLock(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string): Promise<void> {
  const result = await tx.$queryRaw<{ got: number | bigint | null }[]>`
    SELECT GET_LOCK(${key}, 10) AS got
  `;
  const got = result[0]?.got;
  if (Number(got) !== 1) {
    throw Object.assign(new Error('Failed to acquire lock'), { code: 'LOCK_TIMEOUT' });
  }
}

async function releaseNamedLock(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string): Promise<void> {
  await tx.$executeRaw`SELECT RELEASE_LOCK(${key})`;
}

function calculateFee(
  entryDate: string,
  entryTime: string,
  settings: { hourlyRate1: number; hourlyRate2: number; hourlyRate3: number }
) {
  const entry = new Date(`${entryDate}T${entryTime}`);
  const now = new Date();
  const diffMs = now.getTime() - entry.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  let fee = 0;
  if (diffMins <= 60) {
    fee = settings.hourlyRate1;
  } else if (diffMins <= 120) {
    fee = settings.hourlyRate1 + settings.hourlyRate2;
  } else {
    const extraHours = Math.ceil((diffMins - 120) / 60);
    fee = settings.hourlyRate1 + settings.hourlyRate2 + extraHours * settings.hourlyRate3;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  let duration = '';
  if (days > 0) duration += `${days}d `;
  if (remHours > 0) duration += `${remHours}h `;
  duration += `${mins}m`;

  return { fee, duration: duration.trim() };
}

interface LoyaltyLogPayload {
  loyaltyId: string;
  eventType: LoyaltyEventType;
  description: string;
  visitsBefore: number;
  visitsAfter: number;
  rewardsBefore: number;
  rewardsAfter: number;
  vehicleRecordId: string;
  performedBy: string;
  performedByRole: string;
  ipAddress: string;
}

async function getOrCreateLoyalty(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  licensePlate: string
) {
  let loyalty = await tx.customerLoyalty.findUnique({ where: { licensePlate } });
  if (loyalty) return loyalty;

  try {
    return await tx.customerLoyalty.create({ data: { licensePlate } });
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      loyalty = await tx.customerLoyalty.findUnique({ where: { licensePlate } });
      if (loyalty) return loyalty;
    }
    throw error;
  }
}

function pickEditableFields(body: Record<string, unknown>): Partial<Record<EditableField, string | null>> {
  const picked: Partial<Record<EditableField, string | null>> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) {
      const value = body[field];
      if (value === null || value === '') {
        picked[field] = null;
      } else if (typeof value === 'string') {
        picked[field] = field === 'plateNumber' ? value.trim().toUpperCase() : value.trim();
      }
    }
  }
  return picked;
}

function normalizeEditHistory(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAnyRole();
  if (isErrorResponse(auth)) return auth;

  const branchError = requireBranchAssignment(auth);
  if (branchError) return branchError;

  const endpoint = `PUT /api/vehicles/${params.id}`;

  try {
    const body = await req.json();
    const { action, userId: _userId, username: _username, userRole: _userRole, ...rawFields } = body;
    const ip = getClientIp(req);

    const vehicle = await prisma.vehicleRecord.findUnique({ where: { id: params.id } });
    if (!vehicle) return notFound('Vehicle');

    const accessError = assertLocationAccess(auth, vehicle.locationId);
    if (accessError) return accessError;

    if (action === 'exit') {
      if (vehicle.status !== 'inside') {
        return NextResponse.json(
          { error: 'Conflict', message: 'vehicleAlreadyExited' },
          { status: 409 }
        );
      }

      const [settings, vehicleLocation] = await Promise.all([
        prisma.systemSettings.findUnique({ where: { id: 'default' } }),
        prisma.parkingLocation.findUnique({ where: { id: vehicle.locationId } }),
      ]);
      const rateSettings = {
        hourlyRate1: vehicleLocation?.hourlyRate1 ?? settings?.hourlyRate1 ?? 1000,
        hourlyRate2: vehicleLocation?.hourlyRate2 ?? settings?.hourlyRate2 ?? 1500,
        hourlyRate3: vehicleLocation?.hourlyRate3 ?? settings?.hourlyRate3 ?? 2000,
      };
      const { fee: calculatedFee, duration } = calculateFee(vehicle.entryDate, vehicle.entryTime, rateSettings);

      const loyaltyEnabled = settings?.loyaltyEnabled ?? true;
      const visitsRequired = settings?.loyaltyVisitsRequired || 10;
      const rewardType = settings?.loyaltyRewardType || 'free_parking';
      const discountPercent = settings?.loyaltyDiscountPercent || 50;
      const fixedDiscount = settings?.loyaltyFixedDiscount || 0;
      const includeSubscribers = settings?.loyaltyIncludeSubscribers ?? false;

      const isSubscriber = await prisma.monthlySubscriber.findFirst({
        where: { plateNumber: vehicle.plateNumber },
        select: { id: true },
      });
      const shouldProcessLoyalty = loyaltyEnabled && (!isSubscriber || includeSubscribers);

      const now = new Date();
      const exitDate = now.toISOString().split('T')[0];
      const exitTime = now.toTimeString().slice(0, 5);

      const txResult = await prisma.$transaction(async (tx) => {
        const exitClaim = await tx.vehicleRecord.updateMany({
          where: { id: params.id, status: 'inside' },
          data: {
            exitDate,
            exitTime,
            duration,
            status: 'completed',
          },
        });
        if (exitClaim.count === 0) {
          throw Object.assign(new Error('Vehicle has already exited.'), { code: 'ALREADY_EXITED' });
        }

        await tx.parkingSpace.updateMany({
          where: { id: vehicle.parkingSpaceId, status: 'occupied' },
          data: { status: 'available' },
        });

        let finalFee = calculatedFee;
        let loyaltyRewardUsed = false;
        let loyaltyInfo: Awaited<ReturnType<typeof tx.customerLoyalty.update>> | null = null;
        const pendingLogs: LoyaltyLogPayload[] = [];

        if (shouldProcessLoyalty) {
          const loyalty = await getOrCreateLoyalty(tx, vehicle.plateNumber);
          const visitsBefore = loyalty.totalVisits;
          const rewardsBefore = loyalty.availableRewards;

          if (loyalty.availableRewards > 0) {
            loyaltyRewardUsed = true;

            if (rewardType === 'free_parking') {
              finalFee = 0;
            } else if (rewardType === 'percent_discount') {
              finalFee = Math.round(calculatedFee * (1 - discountPercent / 100));
            } else if (rewardType === 'fixed_discount') {
              finalFee = Math.max(0, calculatedFee - fixedDiscount);
            }

            const updatedLoyalty = await tx.customerLoyalty.update({
              where: { id: loyalty.id },
              data: {
                availableRewards: { decrement: 1 },
                totalRewardsRedeemed: { increment: 1 },
                lastVisit: now,
              },
            });

            pendingLogs.push({
              loyaltyId: loyalty.id,
              eventType: 'reward_redeemed',
              description: `Reward redeemed on exit. Fee: ${calculatedFee} → ${finalFee} IQD (${rewardType})`,
              visitsBefore,
              visitsAfter: visitsBefore,
              rewardsBefore,
              rewardsAfter: updatedLoyalty.availableRewards,
              vehicleRecordId: params.id,
              performedBy: auth.username,
              performedByRole: auth.role,
              ipAddress: ip,
            });

            loyaltyInfo = updatedLoyalty;
          } else {
            const newVisits = loyalty.totalVisits + 1;
            let newRewards = loyalty.availableRewards;
            let newRewardsEarned = loyalty.totalRewardsEarned;
            let rewardJustEarned = false;

            if (newVisits >= visitsRequired) {
              newRewards += 1;
              newRewardsEarned += 1;
              rewardJustEarned = true;
            }

            const updatedLoyalty = await tx.customerLoyalty.update({
              where: { id: loyalty.id },
              data: {
                totalVisits: rewardJustEarned ? 0 : newVisits,
                availableRewards: newRewards,
                totalRewardsEarned: newRewardsEarned,
                lastVisit: now,
              },
            });

            pendingLogs.push({
              loyaltyId: loyalty.id,
              eventType: 'visit_added',
              description: `Visit recorded on exit. Total visits: ${visitsBefore} → ${rewardJustEarned ? 0 : newVisits}`,
              visitsBefore,
              visitsAfter: rewardJustEarned ? 0 : newVisits,
              rewardsBefore,
              rewardsAfter: newRewards,
              vehicleRecordId: params.id,
              performedBy: auth.username,
              performedByRole: auth.role,
              ipAddress: ip,
            });

            if (rewardJustEarned) {
              pendingLogs.push({
                loyaltyId: loyalty.id,
                eventType: 'reward_earned',
                description: `Reward earned after ${visitsRequired} visits. Counter reset to 0.`,
                visitsBefore: newVisits,
                visitsAfter: 0,
                rewardsBefore,
                rewardsAfter: newRewards,
                vehicleRecordId: params.id,
                performedBy: auth.username,
                performedByRole: auth.role,
                ipAddress: ip,
              });
            }

            loyaltyInfo = updatedLoyalty;
          }
        }

        const record = await tx.vehicleRecord.update({
          where: { id: params.id },
          data: {
            fee: finalFee,
            loyaltyRewardUsed,
            receiptNumber: generateReceiptNumber(now),
            receiptGeneratedAt: now,
          },
        });

        return { record, loyaltyInfo, loyaltyRewardUsed, originalFee: calculatedFee, pendingLogs };
      }, TX_OPTIONS);

      if (txResult.pendingLogs.length > 0) {
        await prisma.loyaltyLog.createMany({ data: txResult.pendingLogs });
      }

      void auditLog({
        actor: auth,
        action: `Vehicle exit: ${vehicle.plateNumber}, Fee: ${txResult.record.fee} IQD, Duration: ${txResult.record.duration}${txResult.loyaltyRewardUsed ? ' [LOYALTY REWARD APPLIED]' : ''}`,
        category: 'vehicle',
        locationId: vehicle.locationId,
        oldValue: `status: inside`,
        newValue: `status: completed, fee: ${txResult.record.fee}${txResult.loyaltyRewardUsed ? ', loyaltyRewardUsed: true' : ''}`,
        ipAddress: ip,
      });

      return NextResponse.json({
        ...txResult.record,
        loyaltyInfo: txResult.loyaltyInfo,
        loyaltyRewardUsed: txResult.loyaltyRewardUsed,
        originalFee: txResult.originalFee,
      });
    }

    const fields = pickEditableFields(rawFields);
    if (Object.keys(fields).length === 0) {
      return NextResponse.json(vehicle);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.vehicleRecord.findUnique({ where: { id: params.id } });
      if (!current) {
        throw Object.assign(new Error('Vehicle not found'), { code: 'P2025' });
      }
      if (current.status !== 'inside') {
        throw Object.assign(new Error('Vehicle is not inside'), { code: 'NOT_INSIDE' });
      }

      const editHistory = normalizeEditHistory(current.editHistory);
      const editRecords: any[] = [];
      const nowStr = new Date().toISOString();

      for (const field of EDITABLE_FIELDS) {
        if (fields[field] !== undefined) {
          const oldVal = String((current as any)[field] || '');
          const newVal = String(fields[field] || '');
          if (oldVal !== newVal) {
            editRecords.push({
              editedBy: auth.username,
              editedByRole: auth.role,
              editedAt: nowStr,
              field,
              oldValue: oldVal,
              newValue: newVal,
            });
          }
        }
      }

      const newPlate = fields.plateNumber ?? current.plateNumber;
      const plateLock = newPlate !== current.plateNumber ? plateLockKey(newPlate) : null;

      if (plateLock) {
        await acquireNamedLock(tx, plateLock);
      }

      try {
        if (fields.plateNumber && fields.plateNumber !== current.plateNumber) {
          const duplicate = await tx.vehicleRecord.findFirst({
            where: {
              plateNumber: fields.plateNumber,
              status: 'inside',
              id: { not: params.id },
            },
            select: { id: true },
          });
          if (duplicate) {
            throw Object.assign(new Error('vehicleAlreadyInside'), { code: 'DUPLICATE_PLATE' });
          }
        }

        let newSpaceId = current.parkingSpaceId;
        let newSpaceNumber = current.parkingSpaceNumber;

        if (fields.parkingSpaceNumber && fields.parkingSpaceNumber !== current.parkingSpaceNumber) {
          const newSpace = await tx.parkingSpace.findFirst({
            where: { spaceNumber: fields.parkingSpaceNumber, locationId: current.locationId },
            select: { id: true, spaceNumber: true },
          });
          if (!newSpace) {
            throw Object.assign(new Error('spaceNotFound'), { code: 'SPACE_NOT_FOUND' });
          }

          const spaceClaim = await tx.parkingSpace.updateMany({
            where: { id: newSpace.id, status: 'available', locationId: current.locationId },
            data: { status: 'occupied' },
          });
          if (spaceClaim.count === 0) {
            throw Object.assign(new Error('spaceNotAvailable'), { code: 'SPACE_UNAVAILABLE' });
          }

          await tx.parkingSpace.updateMany({
            where: { id: current.parkingSpaceId, status: 'occupied' },
            data: { status: 'available' },
          });

          newSpaceId = newSpace.id;
          newSpaceNumber = newSpace.spaceNumber;
        }

        const updateData: Record<string, unknown> = {};
        if (fields.plateNumber !== undefined) updateData.plateNumber = fields.plateNumber;
        if (fields.driverName !== undefined) updateData.driverName = fields.driverName;
        if (fields.vehicleType !== undefined) updateData.vehicleType = fields.vehicleType;
        if (fields.vehicleColor !== undefined) updateData.vehicleColor = fields.vehicleColor;
        if (fields.parkingSpaceNumber !== undefined) {
          updateData.parkingSpaceNumber = newSpaceNumber;
          updateData.parkingSpaceId = newSpaceId;
        }

        const record = await tx.vehicleRecord.update({
          where: { id: params.id },
          data: {
            ...updateData,
            editHistory: [...editHistory, ...editRecords],
          },
        });

        return { record, editRecords, previousParkingSpaceId: current.parkingSpaceId };
      } finally {
        if (plateLock) {
          await releaseNamedLock(tx, plateLock);
        }
      }
    }, TX_OPTIONS);

    if (updated.editRecords.length > 0) {
      const changedFields = updated.editRecords
        .map((r: any) => `${r.field}: "${r.oldValue}" → "${r.newValue}"`)
        .join('; ');
      void auditLog({
        actor: auth,
        action: `Vehicle record edited: ${vehicle.plateNumber}`,
        category: 'vehicle',
        locationId: vehicle.locationId,
        oldValue: updated.editRecords.map((r: any) => `${r.field}: ${r.oldValue}`).join('; '),
        newValue: changedFields,
        ipAddress: ip,
      });
    }

    return NextResponse.json({
      ...updated.record,
      previousParkingSpaceId: updated.previousParkingSpaceId,
    });
  } catch (error: unknown) {
    const mapped = mapPrismaError(error);
    if (mapped) {
      return NextResponse.json({ error: mapped.error, message: mapped.message }, { status: mapped.status });
    }
    logApiError(`${endpoint} failed`, error, { endpoint, method: 'PUT' });
    return NextResponse.json({ error: 'Internal Server Error', message: 'Failed to update vehicle.' }, { status: 500 });
  }
}
