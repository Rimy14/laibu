import type { CookieOptions, Request, Response } from 'express';
import type { Audience } from '../common/auth/auth.types.js';
import type { IssuedSession } from './token.service.js';

/**
 * Browser sessions travel in HttpOnly cookies: page JavaScript can never read
 * them, so an injected script can't steal a session. SameSite=Strict blocks
 * them on cross-site requests. Cookies are host-only, so the admin host
 * and the public host never see each other's sessions.
 */
export const COOKIE = {
  web: { access: 'laibu_at', refresh: 'laibu_rt', refreshPath: '/api/auth', hint: 'laibu_signed_in' },
  admin: { access: 'laibu_admin_at', refresh: 'laibu_admin_rt', refreshPath: '/api/admin/auth', hint: 'laibu_admin_signed_in' },
} as const satisfies Record<Audience, { access: string; refresh: string; refreshPath: string; hint: string }>;

// The "hint" cookie holds no secret (just "1"). It only tells the page that a
// session probably exists, so anonymous visitors don't trigger /me + refresh calls.

const base = (secure: boolean): CookieOptions => ({ httpOnly: true, secure, sameSite: 'strict' });

export function setSessionCookies(res: Response, aud: Audience, s: IssuedSession, secure: boolean) {
  res.cookie(COOKIE[aud].access, s.accessToken, { ...base(secure), path: '/api', maxAge: s.accessExpiresIn * 1000 });
  res.cookie(COOKIE[aud].refresh, s.refreshToken, {
    ...base(secure),
    path: COOKIE[aud].refreshPath,
    maxAge: s.refreshExpiresIn * 1000,
  });
  res.cookie(COOKIE[aud].hint, '1', { secure, sameSite: 'lax', path: '/', maxAge: s.refreshExpiresIn * 1000 });
}

export function clearSessionCookies(res: Response, aud: Audience, secure: boolean) {
  res.clearCookie(COOKIE[aud].access, { ...base(secure), path: '/api' });
  res.clearCookie(COOKIE[aud].refresh, { ...base(secure), path: COOKIE[aud].refreshPath });
  res.clearCookie(COOKIE[aud].hint, { secure, sameSite: 'lax', path: '/' });
}

export function hasSessionCookie(req: Request): boolean {
  const c = (req.cookies ?? {}) as Record<string, string | undefined>;
  return Boolean(c[COOKIE.web.access] || c[COOKIE.web.refresh] || c[COOKIE.admin.access] || c[COOKIE.admin.refresh]);
}

export function clientInfo(req: Request) {
  return { ip: req.ip, userAgent: req.get('user-agent') };
}
