-- Migration: SPMS v2 fields (safe upgrade for existing Railway databases)
-- Adds QR ticket support and extended system settings without deleting data.

-- vehicle_records: QR ticket token for customer parking lookup
ALTER TABLE `vehicle_records`
  ADD COLUMN IF NOT EXISTS `qrToken` VARCHAR(191) NULL;

-- Unique index for qrToken (skip if already present)
SET @idx_exists = (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'vehicle_records'
    AND INDEX_NAME = 'vehicle_records_qrToken_key'
);
SET @sql = IF(
  @idx_exists = 0,
  'CREATE UNIQUE INDEX `vehicle_records_qrToken_key` ON `vehicle_records`(`qrToken`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- system_settings: company / parking branding fields
ALTER TABLE `system_settings`
  ADD COLUMN IF NOT EXISTS `parkingName` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `address` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `phoneNumber` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `companyLogo` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `companyWebsite` VARCHAR(191) NULL;

-- parking_locations: space number prefix (A, B, C, ...)
ALTER TABLE `parking_locations`
  ADD COLUMN IF NOT EXISTS `spacePrefix` VARCHAR(191) NOT NULL DEFAULT 'S';
