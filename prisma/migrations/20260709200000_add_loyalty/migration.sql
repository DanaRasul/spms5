-- Migration: Add Customer Loyalty Program
-- Created: 2026-07-09

-- Add loyalty settings columns to system_settings
ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `loyaltyEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS `loyaltyVisitsRequired` INT NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS `loyaltyRewardType` VARCHAR(191) NOT NULL DEFAULT 'free_parking',
  ADD COLUMN IF NOT EXISTS `loyaltyDiscountPercent` DOUBLE NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS `loyaltyFixedDiscount` DOUBLE NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `loyaltyRewardExpireDays` INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `loyaltyIncludeSubscribers` BOOLEAN NOT NULL DEFAULT false;

-- Add loyaltyRewardUsed to vehicle_records
ALTER TABLE `vehicle_records`
  ADD COLUMN IF NOT EXISTS `loyaltyRewardUsed` BOOLEAN NOT NULL DEFAULT false;

-- Create LoyaltyEventType enum (MySQL uses VARCHAR for enums in Prisma)
-- Create customer_loyalty table
CREATE TABLE IF NOT EXISTS `customer_loyalty` (
  `id` VARCHAR(191) NOT NULL,
  `licensePlate` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NULL,
  `phoneNumber` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `totalVisits` INT NOT NULL DEFAULT 0,
  `availableRewards` INT NOT NULL DEFAULT 0,
  `totalRewardsEarned` INT NOT NULL DEFAULT 0,
  `totalRewardsRedeemed` INT NOT NULL DEFAULT 0,
  `lastVisit` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `customer_loyalty_licensePlate_key`(`licensePlate`),
  INDEX `customer_loyalty_licensePlate_idx`(`licensePlate`),
  INDEX `customer_loyalty_phoneNumber_idx`(`phoneNumber`),
  INDEX `customer_loyalty_totalVisits_idx`(`totalVisits`),
  INDEX `customer_loyalty_availableRewards_idx`(`availableRewards`),
  INDEX `customer_loyalty_lastVisit_idx`(`lastVisit`),
  INDEX `customer_loyalty_createdAt_idx`(`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create loyalty_logs table
CREATE TABLE IF NOT EXISTS `loyalty_logs` (
  `id` VARCHAR(191) NOT NULL,
  `loyaltyId` VARCHAR(191) NOT NULL,
  `eventType` ENUM('visit_added','reward_earned','reward_redeemed','manual_adjustment','reset_by_admin','points_added','points_removed') NOT NULL,
  `description` TEXT NOT NULL,
  `visitsBefore` INT NOT NULL DEFAULT 0,
  `visitsAfter` INT NOT NULL DEFAULT 0,
  `rewardsBefore` INT NOT NULL DEFAULT 0,
  `rewardsAfter` INT NOT NULL DEFAULT 0,
  `vehicleRecordId` VARCHAR(191) NULL,
  `performedBy` VARCHAR(191) NULL,
  `performedByRole` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(191) NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `loyalty_logs_loyaltyId_idx`(`loyaltyId`),
  INDEX `loyalty_logs_eventType_idx`(`eventType`),
  INDEX `loyalty_logs_timestamp_idx`(`timestamp`),
  INDEX `loyalty_logs_vehicleRecordId_idx`(`vehicleRecordId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key for loyalty_logs -> customer_loyalty
ALTER TABLE `loyalty_logs`
  ADD CONSTRAINT `loyalty_logs_loyaltyId_fkey`
  FOREIGN KEY (`loyaltyId`) REFERENCES `customer_loyalty`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
