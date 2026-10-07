import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../common/auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { COOKIE } from './cookies.js';
import { TokenService } from './token.service.js';

/**
 * Identifies the caller on every request. It never rejects on its own: it
 * only sets req.user when the token is valid AND the account is still active,
 * still has the same role, and hasn't changed password since the token was
 * issued. The AccessGuard then decides what an anonymous caller may do.
 *
 * Checking the database on each request means a suspension or role change
 * takes effect immediately, not when the 15-minute token expires.
 */
@Injectable()
export class AuthenticateMiddleware implements NestMiddleware {
  constructor(
    private readonly tokens: TokenService,
    private readonly db: DatabaseService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const token = this.extract(req);
    if (token) {
      try {
        const claims = await this.tokens.verifyAccess(token);
        const { rows } = await this.db.query<{ role: Role; status: string; password_changed_at: Date | null }>(
          'SELECT role, status, password_changed_at FROM users WHERE id = $1',
          [claims.id],
        );
        const u = rows[0];
        const pwChangedAfter = u?.password_changed_at && u.password_changed_at.getTime() / 1000 > claims.iat + 1;
        if (u && u.status === 'active' && u.role === claims.role && !pwChangedAfter) {
          req.user = { id: claims.id, role: claims.role, aud: claims.aud, sid: claims.sid };
        }
      } catch {
        // expired / tampered / wrong key → treated as anonymous; client refreshes on 401
      }
    }
    next();
  }

  private extract(req: Request): string | undefined {
    const header = req.get('authorization');
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();
    const c = (req.cookies ?? {}) as Record<string, string | undefined>;
    return c[COOKIE.admin.access] ?? c[COOKIE.web.access];
  }
}
