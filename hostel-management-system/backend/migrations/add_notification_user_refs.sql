-- Migration: add nullable user_id references to leave_requests, complaints, maintenance_requests
-- for safe automatic notification recipient mapping.
-- Safe, repeatable, non-destructive. Run manually after backup.
-- Backfill only when student email uniquely matches a user account email.

ALTER TABLE leave_requests ADD COLUMN user_id INT NULL;
ALTER TABLE complaints ADD COLUMN user_id INT NULL;
ALTER TABLE maintenance_requests ADD COLUMN user_id INT NULL;

-- Backfill via email match only (students.email = users.email), never by name.
-- Use a subquery that requires exactly one matching user to avoid ambiguous assignment.
UPDATE leave_requests lr
  JOIN students s ON s.name = lr.student_name
  JOIN users u ON u.email = s.email
SET lr.user_id = u.id
WHERE lr.user_id IS NULL
  AND s.email IS NOT NULL
  AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = s.email) = 1;

UPDATE complaints c
  JOIN students s ON s.name = c.student_name
  JOIN users u ON u.email = s.email
SET c.user_id = u.id
WHERE c.user_id IS NULL
  AND s.email IS NOT NULL
  AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = s.email) = 1;

UPDATE maintenance_requests mr
  JOIN students s ON s.name = mr.student_name
  JOIN users u ON u.email = s.email
SET mr.user_id = u.id
WHERE mr.user_id IS NULL
  AND s.email IS NOT NULL
  AND (SELECT COUNT(*) FROM users u2 WHERE u2.email = s.email) = 1;

CREATE INDEX idx_leave_requests_user_id ON leave_requests (user_id);
CREATE INDEX idx_complaints_user_id ON complaints (user_id);
CREATE INDEX idx_maintenance_requests_user_id ON maintenance_requests (user_id);
