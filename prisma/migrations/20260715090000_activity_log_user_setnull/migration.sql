-- Migration: Allow user deletion without losing audit history
--
-- Previously, activity_logs.userId had ON DELETE RESTRICT, so deleting a
-- user failed with a Prisma P2003 foreign key constraint error whenever
-- that user had any activity log entries.
--
-- Fix: make activity_logs.userId nullable and change the foreign key to
-- ON DELETE SET NULL. Deleting a user now sets userId to NULL on their
-- historical logs instead of blocking the deletion or removing the logs.
-- username/userRole are already stored directly on each log row (not
-- looked up through the relation), so historical logs remain fully
-- readable and attributable after the user is gone.

ALTER TABLE `activity_logs` DROP FOREIGN KEY `activity_logs_userId_fkey`;

ALTER TABLE `activity_logs` MODIFY COLUMN `userId` VARCHAR(191) NULL;

ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
