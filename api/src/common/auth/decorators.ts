import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from './auth.types.js';

export const IS_PUBLIC = 'laibu:isPublic';
export const ROLES_KEY = 'laibu:roles';
export const SKIP_TERMS = 'laibu:skipTerms';

/** Opt OUT of authentication. Every route is private unless marked. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restrict a route to roles. The superadmin passes every role check. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Superadmin-only (admin panel) routes: §10 "separate role guard".
 * Also requires an admin-host session (see AccessGuard).
 */
export const AdminOnly = () => Roles('superadmin');

/** Reachable even when the user still has to accept new terms (§9). */
export const SkipTermsCheck = () => SetMetadata(SKIP_TERMS, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<Request>().user;
});
