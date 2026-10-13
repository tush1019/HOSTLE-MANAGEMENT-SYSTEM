/* Compatibility entrypoint.

   Render's original Root Directory for this service points at this folder,
   so instead of the old dummy server we run the REAL HostelHub backend from
   ../hostel-management-system/backend. That backend reads PORT from the
   environment (Render provides it) and falls back to SQLite when MySQL is
   unavailable. */
require("../hostel-management-system/backend/server");