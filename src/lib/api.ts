/**
 * Lightweight API client — wraps fetch with JSON handling, error normalization,
 * and consistent patterns used throughout the app.
 *
 * Usage:
 *   const data = await api.get<Client[]>("/api/clients");
 *   await api.post("/api/clients", body);
 *   await api.put(`/api/clients/${id}`, body);
 *   await api.del(`/api/clients/${id}`);
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText, url);
  }
  // 204 No Content or empty body
  const ct = res.headers.get("content-type") || "";
  if (res.status === 204 || !ct.includes("application/json")) {
    return undefined as T;
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: string,
    public url: string,
  ) {
    super(`API ${status}: ${body} (${url})`);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T = unknown>(url: string) => request<T>(url),

  post: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "POST",
      headers: JSON_HEADERS,
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  put: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "PUT",
      headers: JSON_HEADERS,
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(url: string, body?: unknown) =>
    request<T>(url, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: body != null ? JSON.stringify(body) : undefined,
    }),

  del: <T = unknown>(url: string) =>
    request<T>(url, { method: "DELETE" }),
};
