import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureLocationSpaces } from '@/lib/branchScope';

const prisma = new PrismaClient();

const LOCATION_PREFIXES: Record<string, string> = {
  loc1: 'A',
  loc2: 'B',
};

async function main() {
  console.log('🌱 Seeding SPMS database...');

  // ── System Settings ────────────────────────────────────────────────────────
  await prisma?.systemSettings?.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      totalCapacity: 50,
      hourlyRate1: 1000,
      hourlyRate2: 1500,
      hourlyRate3: 2000,
      currency: 'IQD',
      timezone: 'Asia/Baghdad',
      loyaltyEnabled: true,
      loyaltyVisitsRequired: 10,
      loyaltyRewardType: 'free_parking',
      loyaltyDiscountPercent: 50,
      loyaltyFixedDiscount: 0,
      loyaltyRewardExpireDays: 0,
      loyaltyIncludeSubscribers: false,
    },
  });
  console.log('✅ System settings created');

  // ── Parking Locations ──────────────────────────────────────────────────────
  const mainBranch = await prisma?.parkingLocation?.upsert({
    where: { id: 'loc1' },
    update: {},
    create: {
      id: 'loc1',
      name: 'Main Parking Center',
      address: '123 Main Street, Erbil',
      phoneNumber: '07501234567',
      capacity: 50,
      status: 'active',
    },
  });

  const northBranch = await prisma?.parkingLocation?.upsert({
    where: { id: 'loc2' },
    update: {},
    create: {
      id: 'loc2',
      name: 'North Branch',
      address: '456 North Ave, Sulaymaniyah',
      phoneNumber: '07601234567',
      capacity: 30,
      status: 'active',
    },
  });
  console.log('✅ Parking locations created');

  await prisma.systemSettings.update({
    where: { id: 'default' },
    data: { defaultLocationId: mainBranch.id },
  });

  // ── Hash Passwords ─────────────────────────────────────────────────────────
  const SALT_ROUNDS = 12;
  const adminHash   = await bcrypt?.hash('admin123', SALT_ROUNDS);
  const branch1Hash = await bcrypt?.hash('branch1',  SALT_ROUNDS);
  const branch2Hash = await bcrypt?.hash('branch2',  SALT_ROUNDS);
  const op123Hash   = await bcrypt?.hash('op123',    SALT_ROUNDS);

  // ── Users ──────────────────────────────────────────────────────────────────
  await prisma?.user?.upsert({
    where: { username: 'sysadmin' },
    update: { password: adminHash, branchId: null },
    create: {
      id: 'u1',
      username: 'sysadmin',
      fullName: 'System Administrator',
      email: 'sysadmin@spms.local',
      password: adminHash,
      role: 'system_admin',
      enabled: true,
    },
  });

  await prisma?.user?.upsert({
    where: { username: 'branch1admin' },
    update: { password: branch1Hash, branchId: mainBranch?.id },
    create: {
      id: 'u2',
      username: 'branch1admin',
      fullName: 'Ali Hassan (Main)',
      email: 'ali@spms.local',
      password: branch1Hash,
      role: 'branch_admin',
      enabled: true,
      branchId: mainBranch?.id,
    },
  });

  await prisma?.user?.upsert({
    where: { username: 'branch2admin' },
    update: { password: branch2Hash, branchId: northBranch?.id },
    create: {
      id: 'u3',
      username: 'branch2admin',
      fullName: 'Sara Ahmed (North)',
      email: 'sara@spms.local',
      password: branch2Hash,
      role: 'branch_admin',
      enabled: true,
      branchId: northBranch?.id,
    },
  });

  await prisma?.user?.upsert({
    where: { username: 'operator1' },
    update: { password: op123Hash, branchId: mainBranch?.id },
    create: {
      id: 'u4',
      username: 'operator1',
      fullName: 'Omar Khalid',
      email: 'omar@spms.local',
      password: op123Hash,
      role: 'user_admin',
      enabled: true,
      branchId: mainBranch?.id,
    },
  });

  await prisma?.user?.upsert({
    where: { username: 'operator2' },
    update: { password: op123Hash, branchId: northBranch?.id },
    create: {
      id: 'u5',
      username: 'operator2',
      fullName: 'Layla Nouri',
      email: 'layla@spms.local',
      password: op123Hash,
      role: 'user_admin',
      enabled: true,
      branchId: northBranch?.id,
    },
  });
  console.log('✅ Users created with bcrypt-hashed passwords');

  // ── Parking Spaces – Main Branch (A01–A50) ─────────────────────────────────
  for (let i = 1; i <= 50; i++) {
    const spaceNumber = `A${String(i)?.padStart(2, '0')}`;
    await prisma?.parkingSpace?.upsert({
      where: { id: `sp${i}` },
      update: { spaceNumber, locationId: mainBranch?.id, status: 'available' },
      create: {
        id: `sp${i}`,
        spaceNumber,
        status: 'available',
        locationId: mainBranch?.id,
      },
    });
  }
  console.log('✅ Main branch spaces created (A01–A50)');

  for (let i = 1; i <= 30; i++) {
    const spaceNumber = `B${String(i)?.padStart(2, '0')}`;
    await prisma?.parkingSpace?.upsert({
      where: { id: `sp_b${i}` },
      update: { spaceNumber, locationId: northBranch?.id, status: 'available' },
      create: {
        id: `sp_b${i}`,
        spaceNumber,
        status: 'available',
        locationId: northBranch?.id,
      },
    });
  }
  console.log('✅ North branch spaces created (B01–B30)');

  // Ensure every location (including UI-created branches) has spaces up to capacity
  const allLocations = await prisma.parkingLocation.findMany();
  for (const location of allLocations) {
    const prefix = LOCATION_PREFIXES[location.id] ?? 'S';
    const created = await ensureLocationSpaces(prisma, location.id, location.capacity, prefix);
    if (created > 0) {
      console.log(`✅ Ensured ${created} spaces for ${location.name}`);
    }
  }

  console.log('');
  console.log('════════════════════════════════════════════════════');
  console.log('  ✅ Database seeded successfully!');
  console.log('════════════════════════════════════════════════════');
  console.log('');
  console.log('  Demo accounts (for development only):');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │ Role          │ Username     │ Password      │');
  console.log('  ├─────────────────────────────────────────────┤');
  console.log('  │ System Admin  │ sysadmin     │ admin123      │');
  console.log('  │ Branch Admin  │ branch1admin │ branch1       │');
  console.log('  │ Branch Admin  │ branch2admin │ branch2       │');
  console.log('  │ Operator      │ operator1    │ op123         │');
  console.log('  │ Operator      │ operator2    │ op123         │');
  console.log('  └─────────────────────────────────────────────┘');
  console.log('');
}

main()?.catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })?.finally(async () => {
    await prisma?.$disconnect();
  });
