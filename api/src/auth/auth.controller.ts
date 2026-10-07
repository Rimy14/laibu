import { Body, Controller, ForbiddenException, HttpCode, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuditService } from '../common/audit/audit.service.js';
import type { Audience, AuthUser } from '../common/auth/auth.types.js';
import { CurrentUser, Public, SkipTermsCheck } from '../common/auth/decorators.js';
import type { Env } from '../config/env.js';
import { TermsService } from '../terms/terms.service.js';
import { AcceptTermsDto, LoginDto, RefreshDto, SignupDto } from './auth.dto.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { clearSessionCookies, clientInfo, COOKIE, setSessionCookies } from './cookies.js';
import { TokenService } from './token.service.js';

/** Shared plumbing for the public door (/api/auth) and the admin door (/api/admin/auth). */
abstract class SessionController {
  protected readonly secure: boolean;

  constructor(
    protected readonly auth: AuthService,
    protected readonly tokens: TokenService,
    config: ConfigService<Env, true>,
  ) {
    this.secure = config.get('NODE_ENV', { infer: true }) === 'production';
  }

  /** §5.1: "returns JWT + terms_current flag". Browsers also get HttpOnly cookies. */
  protected respond(res: Response, aud: Audience, r: AuthResult) {
    setSessionCookies(res, aud, r.session, this.secure);
    return {
      user: r.user,
      terms_current: r.terms_current,
      access_token: r.session.accessToken,
      expires_in: r.session.accessExpiresIn,
    };
  }

  protected async refreshFor(aud: Audience, req: Request, res: Response, body: RefreshDto) {
    const presented = (req.cookies as Record<string, string | undefined>)[COOKIE[aud].refresh] ?? body.refresh_token;
    if (!presented) throw new UnauthorizedException('Your session has ended. Please sign in again.');
    try {
      const s = await this.tokens.rotate(presented, aud, clientInfo(req));
      setSessionCookies(res, aud, s, this.secure);
      return { access_token: s.accessToken, expires_in: s.accessExpiresIn };
    } catch (e) {
      clearSessionCookies(res, aud, this.secure);
      throw e;
    }
  }

  protected async logoutFor(aud: Audience, req: Request, res: Response) {
    const presented = (req.cookies as Record<string, string | undefined>)[COOKIE[aud].refresh];
    if (presented) await this.tokens.revokeByToken(presented);
    else if (req.user) await this.tokens.revokeFamily(req.user.sid);
    clearSessionCookies(res, aud, this.secure);
  }
}

@Controller('auth')
export class AuthController extends SessionController {
  constructor(
    auth: AuthService,
    tokens: TokenService,
    config: ConfigService<Env, true>,
    private readonly terms: TermsService,
  ) {
    super(auth, tokens, config);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, 'web', await this.auth.signup(dto, clientInfo(req)));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, 'web', await this.auth.login(dto.email, dto.password, 'web', clientInfo(req)));
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.refreshFor('web', req, res, dto);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.logoutFor('web', req, res);
  }

  /** §5.1 / §9 re-acceptance after the terms change. */
  @SkipTermsCheck()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('terms/accept')
  async acceptTerms(@Body() dto: AcceptTermsDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    await this.terms.accept(
      user.id,
      { termsVersion: dto.accept_terms_version, policyVersion: dto.accept_policy_version },
      clientInfo(req),
    );
    return { terms_current: true };
  }
}

/** The admin panel's own sign-in, reachable only through the admin host. */
@Controller('admin/auth')
export class AdminAuthController extends SessionController {
  private readonly adminOrigin: string;

  constructor(
    auth: AuthService,
    tokens: TokenService,
    config: ConfigService<Env, true>,
    private readonly audit: AuditService,
  ) {
    super(auth, tokens, config);
    this.adminOrigin = new URL(config.get('ADMIN_ORIGIN', { infer: true })).origin;
  }

  /**
   * Admin sessions may only be opened from the admin host's pages. Browsers
   * can't fake the Origin header, so the admin cookies can only ever land on
   * the admin host, never on the public site.
   */
  private requireAdminOrigin(req: Request) {
    if (req.get('origin') !== this.adminOrigin) throw new ForbiddenException('You do not have access to this.');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.requireAdminOrigin(req);
    try {
      const result = await this.auth.login(dto.email, dto.password, 'admin', clientInfo(req));
      req.user = { id: result.user.id, role: result.user.role, aud: 'admin', sid: result.session.familyId };
      await this.audit.record(req, { action: 'admin.login' });
      return this.respond(res, 'admin', result);
    } catch (e) {
      await this.audit.record(req, { action: 'admin.login_failed', metadata: { email: dto.email.slice(0, 254) } });
      throw e;
    }
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.requireAdminOrigin(req);
    return this.refreshFor('admin', req, res, dto);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.user?.aud === 'admin') await this.audit.record(req, { action: 'admin.logout' });
    await this.logoutFor('admin', req, res);
  }
}
