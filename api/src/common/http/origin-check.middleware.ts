import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import { hasSessionCookie } from '../../auth/cookies.js';
import type { Env } from '../../config/env.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence in depth (on top of SameSite=Strict cookies): any request that
 * changes something AND carries a session cookie must come from one of our own
 * origins. Bearer-token clients (no cookies) are unaffected.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: Set<string>;

  constructor(config: ConfigService<Env, true>) {
    this.allowed = new Set([
      new URL(config.get('WEB_ORIGIN', { infer: true })).origin,
      new URL(config.get('ADMIN_ORIGIN', { infer: true })).origin,
    ]);
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE.has(req.method) || !hasSessionCookie(req)) return next();

    const origin = req.get('origin') ?? originOf(req.get('referer'));
    if (!origin || !this.allowed.has(origin)) {
      throw new ForbiddenException('This request was blocked for your security. Please reload the page and try again.');
    }
    next();
  }
}

function originOf(url?: string) {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
