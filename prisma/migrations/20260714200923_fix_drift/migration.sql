-- AlterTable
ALTER TABLE `monthly_subscribers` MODIFY `phoneNumber` VARCHAR(191) NULL,
    MODIFY `vehicleType` VARCHAR(191) NULL,
    MODIFY `vehicleColor` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `parking_locations` MODIFY `phoneNumber` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `vehicle_records_qrToken_idx` ON `vehicle_records`(`qrToken`);
