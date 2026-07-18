-- Migration: Permanent receipt history fields
-- Adds receiptNumber + receiptGeneratedAt to VehicleRecord so completed
-- parking records permanently retain their receipt info (Phase 4).
-- Both are nullable: existing completed records are untouched (no receipt
-- number backfilled) and remain fully readable/printable as before; only
-- vehicles that exit AFTER this migration get a persisted receipt number.

ALTER TABLE `vehicle_records`
  ADD COLUMN `receiptNumber` VARCHAR(191) NULL,
  ADD COLUMN `receiptGeneratedAt` DATETIME(3) NULL;

CREATE UNIQUE INDEX `vehicle_records_receiptNumber_key` ON `vehicle_records`(`receiptNumber`);
