-- CreateTable: parking_locations
CREATE TABLE `parking_locations` (
    `id`          VARCHAR(191) NOT NULL,
    `name`        VARCHAR(191) NOT NULL,
    `address`     VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `capacity`    INTEGER      NOT NULL DEFAULT 50,
    `status`      ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: users
CREATE TABLE `users` (
    `id`        VARCHAR(191) NOT NULL,
    `username`  VARCHAR(191) NOT NULL,
    `fullName`  VARCHAR(191) NOT NULL,
    `email`     VARCHAR(191) NOT NULL,
    `password`  VARCHAR(191) NOT NULL,
    `role`      ENUM('system_admin', 'branch_admin', 'user_admin') NOT NULL DEFAULT 'user_admin',
    `enabled`   BOOLEAN      NOT NULL DEFAULT true,
    `branchId`  VARCHAR(191) NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastLogin` DATETIME(3)  NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: failed_logins
CREATE TABLE `failed_logins` (
    `id`          VARCHAR(191) NOT NULL,
    `userId`      VARCHAR(191) NOT NULL,
    `attemptedAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedUntil` DATETIME(3)  NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: parking_spaces
CREATE TABLE `parking_spaces` (
    `id`          VARCHAR(191) NOT NULL,
    `spaceNumber` VARCHAR(191) NOT NULL,
    `status`      ENUM('available', 'occupied') NOT NULL DEFAULT 'available',
    `locationId`  VARCHAR(191) NOT NULL,

    UNIQUE INDEX `parking_spaces_spaceNumber_locationId_key`(`spaceNumber`, `locationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: vehicle_records
CREATE TABLE `vehicle_records` (
    `id`                 VARCHAR(191) NOT NULL,
    `plateNumber`        VARCHAR(191) NOT NULL,
    `parkingSpaceId`     VARCHAR(191) NOT NULL,
    `parkingSpaceNumber` VARCHAR(191) NOT NULL,
    `locationId`         VARCHAR(191) NOT NULL,
    `entryDate`          VARCHAR(191) NOT NULL,
    `entryTime`          VARCHAR(191) NOT NULL,
    `exitDate`           VARCHAR(191) NULL,
    `exitTime`           VARCHAR(191) NULL,
    `duration`           VARCHAR(191) NULL,
    `fee`                DOUBLE       NULL,
    `status`             ENUM('inside', 'completed') NOT NULL DEFAULT 'inside',
    `driverName`         VARCHAR(191) NULL,
    `vehicleType`        VARCHAR(191) NULL,
    `vehicleColor`       VARCHAR(191) NULL,
    `editHistory`        JSON         NULL,
    `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: monthly_subscribers
CREATE TABLE `monthly_subscribers` (
    `id`                 VARCHAR(191) NOT NULL,
    `plateNumber`        VARCHAR(191) NOT NULL,
    `driverName`         VARCHAR(191) NOT NULL,
    `phoneNumber`        VARCHAR(191) NOT NULL,
    `vehicleType`        VARCHAR(191) NOT NULL,
    `vehicleColor`       VARCHAR(191) NOT NULL,
    `startDate`          VARCHAR(191) NOT NULL,
    `subscriptionPeriod` INTEGER      NOT NULL,
    `paymentAmount`      DOUBLE       NOT NULL,
    `notes`              VARCHAR(191) NULL,
    `expirationDate`     VARCHAR(191) NOT NULL,
    `remainingDays`      INTEGER      NOT NULL,
    `paymentStatus`      ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
    `locationId`         VARCHAR(191) NOT NULL,
    `createdAt`          DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: system_settings
CREATE TABLE `system_settings` (
    `id`                VARCHAR(191) NOT NULL DEFAULT 'default',
    `totalCapacity`     INTEGER      NOT NULL DEFAULT 50,
    `hourlyRate1`       DOUBLE       NOT NULL DEFAULT 1000,
    `hourlyRate2`       DOUBLE       NOT NULL DEFAULT 1500,
    `hourlyRate3`       DOUBLE       NOT NULL DEFAULT 2000,
    `currency`          VARCHAR(191) NOT NULL DEFAULT 'IQD',
    `timezone`          VARCHAR(191) NOT NULL DEFAULT 'Asia/Baghdad',
    `defaultLocationId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: activity_logs
CREATE TABLE `activity_logs` (
    `id`         VARCHAR(191) NOT NULL,
    `userId`     VARCHAR(191) NOT NULL,
    `username`   VARCHAR(191) NOT NULL,
    `userRole`   ENUM('system_admin', 'branch_admin', 'user_admin') NOT NULL,
    `action`     TEXT         NOT NULL,
    `category`   VARCHAR(191) NOT NULL,
    `oldValue`   TEXT         NULL,
    `newValue`   TEXT         NULL,
    `timestamp`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress`  VARCHAR(191) NULL,
    `locationId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: users.branchId → parking_locations.id
ALTER TABLE `users` ADD CONSTRAINT `users_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `parking_locations`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: failed_logins.userId → users.id
ALTER TABLE `failed_logins` ADD CONSTRAINT `failed_logins_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: parking_spaces.locationId → parking_locations.id
ALTER TABLE `parking_spaces` ADD CONSTRAINT `parking_spaces_locationId_fkey`
    FOREIGN KEY (`locationId`) REFERENCES `parking_locations`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: vehicle_records.parkingSpaceId → parking_spaces.id
ALTER TABLE `vehicle_records` ADD CONSTRAINT `vehicle_records_parkingSpaceId_fkey`
    FOREIGN KEY (`parkingSpaceId`) REFERENCES `parking_spaces`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: vehicle_records.locationId → parking_locations.id
ALTER TABLE `vehicle_records` ADD CONSTRAINT `vehicle_records_locationId_fkey`
    FOREIGN KEY (`locationId`) REFERENCES `parking_locations`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: monthly_subscribers.locationId → parking_locations.id
ALTER TABLE `monthly_subscribers` ADD CONSTRAINT `monthly_subscribers_locationId_fkey`
    FOREIGN KEY (`locationId`) REFERENCES `parking_locations`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: activity_logs.userId → users.id
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: activity_logs.locationId → parking_locations.id
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_locationId_fkey`
    FOREIGN KEY (`locationId`) REFERENCES `parking_locations`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
