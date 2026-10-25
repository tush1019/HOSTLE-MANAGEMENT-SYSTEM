# HostelHub Project Documentation

## 1. Project Overview
HostelHub is a full-stack hostel management web application with separate Admin and Student panels. It manages rooms, students, fees, complaints, mess, facilities, notices, leave/maintenance requests, staff/faculty, chat messaging, and hostel information modules.

## 2. Objectives
- Centralize hostel operations.
- Provide role-based access for Admin and Student users.
- Persist operational data in MySQL or SQLite fallback.
- Support deployment on Render.

## 3. Technology Stack
- Frontend: React, TypeScript, Vite.
- Backend: Node.js, Express.
- Database: MySQL primary, sql.js SQLite fallback.
- Auth: stateless localStorage session with `x-user-id` and `x-user-email` headers validated against `users`.
- Deployment: Render backend + static frontend (or combined).

## 4. Architecture
- `src/` React SPA.
- `backend/` Express API.
- `backend/db.js` dual MySQL/SQLite database layer.
- `backend/schema.sql` schema and seed data.
- Route modules under `backend/*.js`.

## 5. Features
### Admin Panel
Student management, staff management, room management, fees, complaints, mess menu, facilities, notices, maintenance, leave approvals, reports, settings, campus gallery, chat with students.

### Student Panel
Profile, room view, complaints, leave requests, maintenance requests, mess info, facilities, notices, payments/fees view, chat with admin.

### Staff Management
Admin CRUD for staff/faculty records with search, filters, validation and auto-generated staff codes.

### Chat/Messaging
Private 1-to-1 messaging between Admin and Student users. Includes conversation list, message history, unread counts, read receipts, polling updates.

## 6. Database Schema
See `docs/ER_DIAGRAM.mmd`. All tables are listed in schema.sql. Relationships are mostly logical associations by name/email/room number; no foreign keys are enforced in schema.

Verified logical associations:
- `users.id` ↔ `user_profiles.user_id` / `email`
- `users.id` ↔ `user_preferences.user_id`
- `users.id` ↔ `chat_messages.sender_id` / `recipient_id`
- `users.id` ↔ `campus_gallery.created_by`, `app_settings.updated_by`
- `students.room_number`, `fees.room_number`, `complaints.room_number`, etc. ↔ `rooms.room_number`

## 7. API Endpoints
Base: `/api`

Authentication: protected endpoints require `x-user-id` and `x-user-email` matching a valid user. Admin-only endpoints additionally require `role = Admin`.

Routes:
- `/api/auth` - login, signup, OTP verification, logout.
- `/api/students` - student CRUD (admin).
- `/api/staff` - staff CRUD (admin).
- `/api/rooms` - room management.
- `/api/fees` - fee records.
- `/api/complaints` - complaints.
- `/api/mess` - mess menu.
- `/api/facilities` - facilities.
- `/api/notices` - notices.
- `/api/dashboard` - dashboard summaries.
- `/api/services` - hostel services.
- `/api/maintenance` - maintenance requests.
- `/api/leave` - leave requests.
- `/api/gym` - gym photos.
- `/api/room-issues` - room issue photos.
- `/api/profiles` - user profiles.
- `/api/campus-gallery` - campus gallery.
- `/api/settings` - app settings.
- `/api/faculty-rooms` - faculty room details.
- `/api/chat` - messaging.

## 8. Setup
1. Clone repository.
2. Install backend dependencies: `cd backend && npm install`.
3. Install frontend dependencies: `npm install`.
4. Configure `.env` in backend.
5. Start backend: `npm start` or `node server.js`.
6. Start frontend dev: `npm run dev`.
7. Build frontend: `npm run build`.

## 9. Environment Variables
- `PORT`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET` if used by auth
- `EMAIL_*` / SMTP settings for OTP
- `VITE_API_URL` for frontend

No secrets should be committed.

## 10. OTP/Login/Signup
Signup creates pending OTP verification. OTP is emailed and verified before user creation. Login validates credentials and verified status. Logout is client-side session clear plus optional server call.

## 11. Render Deployment
- Backend uses `process.env.PORT`.
- MySQL env vars configure persistent database.
- If MySQL unavailable, SQLite fallback is used but may not persist across redeploys.
- Frontend build output served by backend if `dist` exists.

## 12. Security
- Role checks on backend, not frontend only.
- Input validation on endpoints.
- Password hashing.
- OTP attempt limits.
- No secrets in docs.

## 13. Testing
- Backend syntax checks.
- Frontend production build.
- Staff CRUD E2E.
- Chat E2E and authorization.

## 14. Known Limitations
- No enforced foreign keys.
- SQLite fallback persistence limitations.
- Messaging uses polling, not websockets.
- Staff records are not linked to login users.

## 15. Future Enhancements
- Real-time websockets.
- FK constraints and migrations.
- File uploads to cloud storage.
- Automated tests.
