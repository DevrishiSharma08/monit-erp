const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

let _accessToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  _accessToken = token;
}

export function getAccessToken(): string | null {
  return _accessToken;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Backend envelope shape ───────────────────────────────────────────────────

interface ApiEnvelope<T> {
  success: boolean;
  data:    T | null;
  message: string;
  errors:  string[];
}

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function doFetch<T>(
  path: string,
  options: RequestInit = {},
  token: string | null = _accessToken
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  // No body
  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text.trim()) throw new ApiError(res.status, `Request failed (${res.status})`);

  const body = JSON.parse(text) as ApiEnvelope<T>;

  if (!res.ok || !body.success) {
    // errors[0] gives the specific message (e.g. "Invalid username or password.")
    // message alone is often the generic "Validation failed"
    const msg = body.errors?.[0] ?? body.message ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }

  return body.data as T;
}

// ─── Refresh (deduplicated) ───────────────────────────────────────────────────

async function doRefresh(): Promise<string | null> {
  try {
    const data = await doFetch<{ accessToken: string }>(
      "/api/v1/auth/refresh",
      { method: "POST" },
      null
    );
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}

export function refreshOnce(): Promise<string | null> {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

// ─── Auth-settle gate ─────────────────────────────────────────────────────────
// All non-auth apiFetch calls wait here until AuthProvider finishes its initial
// session restore, so no request fires with a null token on page refresh.

let _authSettled = false;
let _authSettleResolve: (() => void) | null = null;
const _authSettlePromise = new Promise<void>(resolve => { _authSettleResolve = resolve; });

export function notifyAuthSettled(): void {
  if (_authSettled) return;
  _authSettled = true;
  _authSettleResolve?.();
}

// ─── Public ───────────────────────────────────────────────────────────────────

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  if (!path.startsWith("/api/v1/auth/")) {
    await _authSettlePromise;
  }
  const doGet = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${path}`, { credentials: "include", headers });
    if (!res.ok) throw new ApiError(res.status, `Download failed (${res.status})`);
    const cd = res.headers.get("content-disposition") ?? "";
    const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    const filename = match ? match[1].replace(/['"]/g, "") : "download.pdf";
    return { blob: await res.blob(), filename };
  };
  try {
    return await doGet(_accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const newToken = await refreshOnce();
      if (!newToken) throw err;
      return doGet(newToken);
    }
    throw err;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/v1/auth/")) {
    await _authSettlePromise;
  }
  try {
    return await doFetch<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      const newToken = await refreshOnce();
      if (!newToken) throw err;
      return doFetch<T>(path, options, newToken);
    }
    throw err;
  }
}
