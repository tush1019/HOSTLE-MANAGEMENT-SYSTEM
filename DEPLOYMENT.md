# Deployment (Render)

## Backend environment variables

Set these in **Render Dashboard -> your backend service -> Environment**.
Do not commit real values to Git. `render.yaml` intentionally uses `sync: false`
for secrets so Render keeps them out of the repository.

### Required

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Required in production. Generate a long, random, unique value (at least 32 bytes). Example generator: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` or `openssl rand -hex 48`. Never reuse this value elsewhere. |
| `JWT_EXPIRES` | Token lifetime, e.g. `8h` |
| `ADMIN_PASSKEY` | 6-digit admin registration passkey |
| `FACULTY_SIGNUP_KEY` | 6-digit faculty registration passkey (separate from `JWT_SECRET` and `ADMIN_PASSKEY`) |

### Database (MySQL; optional but recommended)

If these are not set, the backend falls back to SQLite for local/non-persistent use.

| Variable | Notes |
|---|---|
| `DB_HOST` | MySQL host |
| `DB_PORT` | MySQL port, usually `3306` |
| `DB_USER` | MySQL user |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | MySQL database name |
| `FRONTEND_URL` | Deployed frontend origin for CORS |

### Optional email settings

Configure either EmailJS or SMTP variables from `backend/.env.example`.

## Manual Render steps

1. Open **Render Dashboard -> hostle-management-system -> Environment**.
2. Add `JWT_SECRET` with a newly generated strong value.
3. Add or verify `ADMIN_PASSKEY` and `FACULTY_SIGNUP_KEY`.
4. Add MySQL variables if using a hosted MySQL database.
5. Save the environment changes.
6. Trigger **Manual Deploy** (or wait for the GitHub push to deploy).
7. Check logs for successful startup and database connection.

The MySQL Faculty role migration runs automatically only after a successful
MySQL connection. Look for `[db] Verified Faculty role support` in the logs.
Do not assume the migration succeeded unless that log appears.
## Service verification

Verify the **same Render service** that shows these logs:

- `Running 'npm start'`
- `HOSTEL BACKEND/server.js` or `hostel-management-system/backend/server.js`
- `HostelHub Backend running on port ...`

Check **Settings -> Root Directory**:

- If it is `HOSTEL BACKEND`, Render uses `HOSTEL BACKEND/package.json` and its `npm start`.
- If it is the repository root, Render uses the root `package.json` / `render.yaml` start command.

Environment variables must be added to **that exact service**. If duplicate backend services exist, disable or delete the extras to avoid deploying one service with variables and another without them.

## Startup diagnostics

The backend logs an environment check at startup showing only `present` or `MISSING`
for required variables. It never logs secret values. If `JWT_SECRET` shows `MISSING`,
add it to the same Render service and redeploy.

