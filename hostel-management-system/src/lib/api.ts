/* Shared API helper — all backend calls go through here. */

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

type ApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await response.text();
  let data: any = null;
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Server returned an invalid response (${response.status}). ${rawText.slice(0, 160)}`);
    }
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  // Endpoints return { success, data } or { success, data, summary }.
  // If `data` key exists use it, otherwise the whole payload is the result.
  if (data && typeof data === "object" && "data" in data) {
    return data.data as T;
  }

  return data as T;
}

/* Raw fetch for endpoints with extra fields (e.g. fees summary) */
export async function apiRaw<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const rawText = await response.text();
  let data: any = null;
  if (rawText.trim()) {
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Server returned an invalid response (${response.status}). ${rawText.slice(0, 160)}`);
    }
  }

  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || `Request failed (${response.status})`);
  }

  return data as T;
}

export function getStoredUser(): { id: number; name: string; email: string; role: string; admin_id?: string | null } | null {
  try {
    const raw = localStorage.getItem("hostelUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/* Headers sent with every authenticated request so backend routes can
   verify the caller's identity and role (stateless localStorage session). */
export function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("hostelToken");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const user = getStoredUser();
  if (user) {
    headers["x-user-id"] = String(user.id);
    headers["x-user-email"] = String(user.email || "");
  }
  return headers;
}
