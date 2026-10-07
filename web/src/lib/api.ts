/**
 * Browser → API calls. Always same-origin (/api is proxied to NestJS by
 * next.config.ts), so the HttpOnly session cookies travel automatically and
 * page JavaScript never sees a token.
 *
 * - An expired session is refreshed once, silently, then the call is retried.
 * - 428 (new terms to accept, §9) raises a window event the TermsGate listens for.
 * - Every failure becomes an ApiError whose `message` is safe to show the user.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const TERMS_REQUIRED_EVENT = "laibu:terms-required";
export const SESSION_ENDED_EVENT = "laibu:session-ended";

type Json = Record<string, unknown> | unknown[];

interface Options extends Omit<RequestInit, "body"> {
  body?: Json;
  timeoutMs?: number;
  /** Internal: set on the retry after a refresh. */
  _retried?: boolean;
}

/** The admin panel has its own sessions on its own host. */
export function isAdminArea() {
  return typeof window !== "undefined" && window.location.hostname.startsWith("admin.");
}

export function authBase() {
  return isAdminArea() ? "/admin/auth" : "/auth";
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit a 401 together. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`/api${authBase()}/refresh`, {
    method: "POST",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  return refreshing;
}

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const { body, timeoutMs = 20_000, headers, _retried, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: init.signal ?? controller.signal,
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    throw new ApiError(
      aborted
        ? "This is taking longer than usual. Please check your connection and try again."
        : "We couldn't reach Laibu. Please check your internet connection.",
      0,
      aborted ? "timeout" : "network_error",
    );
  } finally {
    clearTimeout(timer);
  }

  const isAuthCall = path.startsWith("/auth/") || path.startsWith("/admin/auth/");
  if (res.status === 401 && !isAuthCall && !_retried) {
    if (await refreshSession()) return api<T>(path, { ...opts, _retried: true });
    window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 428) window.dispatchEvent(new Event(TERMS_REQUIRED_EVENT));
    const err = (data as { error?: { code?: string; message?: string; requestId?: string } } | null)?.error;
    throw new ApiError(
      err?.message ?? "Something went wrong. Please try again.",
      res.status,
      err?.code ?? "error",
      err?.requestId,
    );
  }
  return data as T;
}

/** True when the non-secret "signed in" hint cookie exists for this host. */
export function hasSessionHint() {
  if (typeof document === "undefined") return false;
  const name = isAdminArea() ? "laibu_admin_signed_in" : "laibu_signed_in";
  return document.cookie.split("; ").some((c) => c.startsWith(`${name}=`));
}
