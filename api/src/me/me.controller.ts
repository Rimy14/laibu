import {
  Body,
  Controller,
  Get,
  Patch,
  Put,
  ForbiddenException,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { cleanName, normaliseKenyanMobile, PUBLIC_USER_COLUMNS, type PublicUser } from '../auth/users.js';
import { AuditService } from '../common/audit/audit.service.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { CurrentUser, Roles, SkipTermsCheck } from '../common/auth/decorators.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { DatabaseService } from '../database/database.service.js';
import { TermsService } from '../terms/terms.service.js';
import { PayoutMethodDto, UpdateProfileDto } from './me.dto.js';

const normalizeForMatch = (s: string) => cleanName(s).toLowerCase();

@Controller('me')
export class MeController {
  constructor(
    private readonly db: DatabaseService,
    private readonly auth: AuthService,
    private readonly terms: TermsService,
    private readonly crypto: FieldEncryptionService,
    private readonly audit: AuditService,
  ) {}

  /** Profile + §9 flag. Allowed while terms are stale so the client can show the modal. */
  @SkipTermsCheck()
  @Get()
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.auth.profile(user.id);
    const terms_current = user.role === 'superadmin' ? true : await this.terms.isCurrent(user.id);
    return { user: profile, terms_current };
  }

  @Patch()
  async update(@Body() dto: UpdateProfileDto, @CurrentUser() user: AuthUser) {
    const sets: string[] = [];
    const params: unknown[] = [user.id];
    if (dto.full_name !== undefined) {
      params.push(cleanName(dto.full_name));
      sets.push(`full_name = $${params.length}`);
    }
    if (dto.phone !== undefined) {
      const phone = dto.phone.trim() ? normaliseKenyanMobile(dto.phone) : null;
      if (dto.phone.trim() && !phone) throw new UnprocessableEntityException('Enter a Kenyan mobile number, e.g. 0712 345 678.');
      params.push(phone);
      sets.push(`phone = $${params.length}`);
    }
    if (!sets.length) return { user: await this.auth.profile(user.id) };

    const { rows } = await this.db.query<PublicUser>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PUBLIC_USER_COLUMNS}`,
      params,
    );
    const updated = rows[0];

    // §2.6: the payout name is checked again at report time; tell the user now.
    const pm = await this.db.query<{ account_name: string }>('SELECT account_name FROM payout_methods WHERE user_id = $1', [user.id]);
    const payout_name_mismatch = Boolean(pm.rows[0] && normalizeForMatch(pm.rows[0].account_name) !== normalizeForMatch(updated.full_name));
    return { user: updated, payout_name_mismatch };
  }

  /** Masked: never returns the account number or phone, only the last 4 digits. */
  @Roles('author', 'publisher')
  @Get('payout-method')
  async getPayoutMethod(@CurrentUser() user: AuthUser) {
    const { rows } = await this.db.query(
      `SELECT pm.type, pm.account_name, pm.bank_name, pm.bank_branch, pm.account_last4, pm.updated_at,
              normalize_name(pm.account_name) = normalize_name(u.full_name) AS name_matches
         FROM payout_methods pm JOIN users u ON u.id = pm.user_id
        WHERE pm.user_id = $1`,
      [user.id],
    );
    return {
      method: rows[0] ?? null,
      allowed_types: user.role === 'publisher' ? ['bank'] : ['mpesa', 'bank'],
    };
  }

  /**
   * §2.6: authors M-Pesa or bank, publishers bank only; the account name must
   * match the registered full name. Enforced here with friendly messages, and
   * again by a database trigger. Numbers are encrypted and bound to this user.
   */
  @Roles('author', 'publisher')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Put('payout-method')
  async setPayoutMethod(@Body() dto: PayoutMethodDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    // 403, not 401: the session is fine, only the confirmation failed (a 401
    // would make the client think the session expired).
    if (!(await this.auth.checkPassword(user.id, dto.current_password))) {
      throw new ForbiddenException('That password is incorrect.');
    }
    const profile = await this.auth.profile(user.id);

    if (user.role === 'publisher' && dto.type !== 'bank') {
      throw new UnprocessableEntityException('Publishers are paid by bank transfer only.');
    }
    const accountName = cleanName(dto.account_name);
    if (normalizeForMatch(accountName) !== normalizeForMatch(profile.full_name)) {
      throw new UnprocessableEntityException(
        `The account name must match your registered name exactly: "${profile.full_name}". If your name is wrong, update it in your profile first.`,
      );
    }

    let mpesaEnc: Buffer | null = null;
    let bankEnc: Buffer | null = null;
    let last4: string;
    if (dto.type === 'mpesa') {
      const phone = normaliseKenyanMobile(dto.mpesa_phone ?? '');
      if (!phone) throw new UnprocessableEntityException('Enter a Kenyan M-Pesa number, e.g. 0712 345 678.');
      mpesaEnc = this.crypto.encrypt(phone, user.id);
      last4 = FieldEncryptionService.last4(phone);
    } else {
      const account = (dto.bank_account ?? '').replace(/[\s-]/g, '');
      if (!/^[0-9A-Za-z]{6,20}$/.test(account)) {
        throw new UnprocessableEntityException('Enter a valid account number (6 to 20 letters or digits).');
      }
      bankEnc = this.crypto.encrypt(account, user.id);
      last4 = account.replace(/\D/g, '').slice(-4) || account.slice(-4);
      if (!/^[0-9]{2,4}$/.test(last4)) last4 = '0000';
    }

    return this.db.transaction(async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO payout_methods (user_id, type, account_name, mpesa_phone_enc, bank_name, bank_branch, bank_account_enc, account_last4)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id) DO UPDATE SET
           type = EXCLUDED.type, account_name = EXCLUDED.account_name,
           mpesa_phone_enc = EXCLUDED.mpesa_phone_enc, bank_name = EXCLUDED.bank_name,
           bank_branch = EXCLUDED.bank_branch, bank_account_enc = EXCLUDED.bank_account_enc,
           account_last4 = EXCLUDED.account_last4
         RETURNING type, account_name, bank_name, bank_branch, account_last4, updated_at`,
        [
          user.id,
          dto.type,
          accountName,
          mpesaEnc,
          dto.type === 'bank' ? cleanName(dto.bank_name ?? '') : null,
          dto.type === 'bank' && dto.bank_branch?.trim() ? cleanName(dto.bank_branch) : null,
          bankEnc,
          last4,
        ],
      );
      await this.audit.record(
        req,
        { action: 'payout_method.update', entityType: 'user', entityId: user.id, metadata: { type: dto.type, last4 } },
        tx,
      );
      return { method: { ...rows[0], name_matches: true } };
    });
  }
}
