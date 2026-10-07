import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from './auth.types.js';
import { IS_PUBLIC, ROLES_KEY } from './decorators.js';

/**
 * Global, deny-by-default access guard.
 *  1. @Public() routes are open.
 *  2. Everything else needs an authenticated user.
 *  3. @Roles(...) narrows further; the superadmin can go anywhere.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) throw new UnauthorizedException('Please sign in to continue.');

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, targets);
    if (!roles || roles.length === 0) return true;

    // Admin-panel routes need a session opened on the admin host, not just the role.
    const adminOnly = roles.length === 1 && roles[0] === 'superadmin';
    if (adminOnly) {
      if (user.role === 'superadmin' && user.aud === 'admin') return true;
      throw new ForbiddenException('You do not have access to this.');
    }
    if (user.role === 'superadmin' || roles.includes(user.role)) return true;

    throw new ForbiddenException('You do not have access to this.');
  }
}
