/* Shared app constants used across auth screens.

   NOTE: The admin passkey is validated only by the backend (see
   backend/auth.js, ADMIN_PASSKEY from backend/.env). It must never
   be hardcoded or compared in frontend source code. The frontend
   simply collects the passkey from the admin and sends it to the
   server for verification.
*/

export const APP_NAME = "HostelHub";
