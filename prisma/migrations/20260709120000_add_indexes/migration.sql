-- Migration: Add database indexes for performance + backup_restore audit category
-- Run: npx prisma migrate deploy

-- Indexes for users table
ALTER TABLE `users` ADD INDEX `users_role_idx` (`role`);
ALTER TABLE `users` ADD INDEX `users_branchId_idx` (`branchId`);
ALTER TABLE `users` ADD INDEX `users_enabled_idx` (`enabled`);
ALTER TABLE `users` ADD INDEX `users_createdAt_idx` (`createdAt`);

-- Indexes for failed_logins table
ALTER TABLE `failed_logins` ADD INDEX `failed_logins_userId_idx` (`userId`);
ALTER TABLE `failed_logins` ADD INDEX `failed_logins_attemptedAt_idx` (`attemptedAt`);

-- Indexes for parking_locations table
ALTER TABLE `parking_locations` ADD INDEX `parking_locations_status_idx` (`status`);
ALTER TABLE `parking_locations` ADD INDEX `parking_locations_createdAt_idx` (`createdAt`);

-- Indexes for parking_spaces table
ALTER TABLE `parking_spaces` ADD INDEX `parking_spaces_locationId_idx` (`locationId`);
ALTER TABLE `parking_spaces` ADD INDEX `parking_spaces_status_idx` (`status`);
ALTER TABLE `parking_spaces` ADD INDEX `parking_spaces_locationId_status_idx` (`locationId`, `status`);

-- Indexes for vehicle_records table
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_plateNumber_idx` (`plateNumber`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_locationId_idx` (`locationId`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_parkingSpaceId_idx` (`parkingSpaceId`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_status_idx` (`status`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_locationId_status_idx` (`locationId`, `status`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_plateNumber_status_idx` (`plateNumber`, `status`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_createdAt_idx` (`createdAt`);
ALTER TABLE `vehicle_records` ADD INDEX `vehicle_records_entryDate_idx` (`entryDate`);

-- Indexes for monthly_subscribers table
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_plateNumber_idx` (`plateNumber`);
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_locationId_idx` (`locationId`);
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_paymentStatus_idx` (`paymentStatus`);
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_locationId_paymentStatus_idx` (`locationId`, `paymentStatus`);
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_expirationDate_idx` (`expirationDate`);
ALTER TABLE `monthly_subscribers` ADD INDEX `monthly_subscribers_createdAt_idx` (`createdAt`);

-- Indexes for activity_logs table
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_userId_idx` (`userId`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_username_idx` (`username`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_category_idx` (`category`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_locationId_idx` (`locationId`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_timestamp_idx` (`timestamp`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_locationId_timestamp_idx` (`locationId`, `timestamp`);
ALTER TABLE `activity_logs` ADD INDEX `activity_logs_category_timestamp_idx` (`category`, `timestamp`);