/* Shared app constants used across auth screens. */

/* Admin passkey — env override or built-in default (6 digits). */
export const ADMIN_PASSKEY =
  (import.meta.env.VITE_ADMIN_PASSKEY as string) || "484950";
