import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 *  1. Admin lives on its own host (admin.laibu.co.ke / admin.localhost:3000).
 *     On that host every path is served from app/admin; on the public host
 *     /admin does not exist (plain 404, no hint that an admin panel is there).
 *  2. A fresh CSP nonce per request, so only our own scripts can run.
 */
const ADMIN_HOST = (process.env.ADMIN_HOST ?? "admin.localhost:3000").toLowerCase();

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const { pathname } = request.nextUrl;
  const isAdminHost = host === ADMIN_HOST;

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // Optimistic sign-in redirect using the non-secret hint cookie. The real
  // check is the API rejecting the request; this only saves a page flash.
  const signInFirst = (cookie: string) => {
    if (request.cookies.has(cookie)) return null;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    const r = NextResponse.redirect(url);
    r.headers.set("Content-Security-Policy", csp);
    return r;
  };

  let response: NextResponse;
  if (isAdminHost) {
    if (pathname !== "/login") {
      const redirect = signInFirst("laibu_admin_signed_in");
      if (redirect) return redirect;
    }
    // /admin/... typed directly on the admin host → canonical path without the prefix
    if (pathname === "/admin" || pathname.startsWith("/admin/")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.slice("/admin".length) || "/";
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  } else if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/__not-found"; // no such route → the normal 404 page
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
      const redirect = signInFirst("laibu_signed_in");
      if (redirect) return redirect;
    }
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Dev tooling (error overlay, HMR) injects styles without a nonce; production stays strict.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    // React writes some style="" attributes (e.g. progress widths); attributes cannot run code
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export const config = {
  // Prefetches are NOT skipped: on the admin host they must be rewritten too.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
