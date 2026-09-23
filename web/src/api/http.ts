export const BASE = (import.meta.env.VITE_API_URL as string) || "/api";

export interface ConflictInfo {
  type: "file" | "folder";
  name: string;
  existing_id: string;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  conflict?: ConflictInfo;
}

export function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export const genericHttpMessage = (status: number) => `Request failed (${status})`;

export async function handle(res: Response) {
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    let message = genericHttpMessage(res.status);
    let code: string | undefined;
    let conflict: ConflictInfo | undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      if (body?.code) code = body.code;
      if (body?.conflict) conflict = body.conflict;
    } catch {
    }
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.code = code;
    err.conflict = conflict;
    throw err;
  }
  return res.json();
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const NO_BODY = Symbol("no-body");

export async function req<T = any>(
  method: Method,
  path: string,
  token: string | null,
  body: unknown = NO_BODY
): Promise<T> {
  const hasBody = body !== NO_BODY;
  const headers: Record<string, string> = {};
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  if (hasBody) headers["Content-Type"] = "application/json";
  return handle(
    await fetch(`${BASE}${path}`, {
      method,
      headers,
      ...(hasBody ? { body: JSON.stringify(body) } : {}),
    })
  ) as Promise<T>;
}
