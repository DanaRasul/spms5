-- Migration: Per-branch parking fee rates
-- Lets each branch admin set their own hourly rates instead of one global rate.
-- Existing behavior is unchanged: defaults match the current global system_settings
-- defaults (1000 / 1500 / 2000), so every existing branch keeps charging the same
-- fee it already does until a branch admin explicitly customizes it.

ALTER TABLE `parking_locations`
  ADD COLUMN `hourlyRate1` DOUBLE NOT NULL DEFAULT 1000,
  ADD COLUMN `hourlyRate2` DOUBLE NOT NULL DEFAULT 1500,
  ADD COLUMN `hourlyRate3` DOUBLE NOT NULL DEFAULT 2000;
