import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC, SKIP_TERMS } from '../common/auth/decorators.js';
import { TermsService } from './terms.service.js';

export const TERMS_REQUIRED_STATUS = 428;

/**
 * §9 requireCurrentTerms: an authenticated user who hasn't accepted the current
 * Terms + Privacy Policy gets 428 { requires_acceptance: true } on everything
 * except the routes needed to read and accept them.
 * The superadmin publishes the terms, so isn't gated by them.
 */
@Injectable()
export class TermsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly terms: TermsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (this.reflector.getAllAndOverride<boolean>(SKIP_TERMS, targets)) return true;

    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user || user.role === 'superadmin') return true;

    if (await this.terms.isCurrent(user.id)) return true;
    throw new HttpException(
      { message: 'Please review and accept the updated terms to continue.', requires_acceptance: true },
      TERMS_REQUIRED_STATUS,
    );
  }
}
