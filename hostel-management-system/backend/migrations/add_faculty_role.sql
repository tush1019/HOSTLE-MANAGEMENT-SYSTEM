-- Migration: add Faculty to users.role and otp_verifications.role ENUM
-- Safe, repeatable, non-destructive.
-- Run manually on the target MySQL database after backing up.

ALTER TABLE users
  MODIFY COLUMN role ENUM('Admin', 'Student', 'Faculty') NOT NULL DEFAULT 'Student';

ALTER TABLE otp_verifications
  MODIFY COLUMN role ENUM('Admin', 'Student', 'Faculty') NOT NULL DEFAULT 'Student';
