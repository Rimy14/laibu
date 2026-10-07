import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type CryptoKey } from 'jose';
import type { Audience, AuthUser, Role } from '../common/auth/auth.types.js';
import { ROLES } from '../common/auth/auth.types.js';
import type { Env } from '../config/env.js';
import { DatabaseService, type Queryable } from '../database/database.service.js';

const ISSUER = 'laibu';

/** Session lifetimes. Admin sessions are deliberately shorter. */
export const SESSION = {
  web: { accessSeconds: 15 * 60, refreshSeconds: 30 * 24 * 3600 },
  admin: { accessSeconds: 10 * 60, refreshSeconds: 12 * 3600 },
} as const satisfies Record<Audience, { accessSeconds: number; refreshSeconds: number }>;

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresIn: number;
  familyId: string;
}

interface ClientInfo {
  ip?: string;
  userAgent?: string;
}

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

/**
 * Short-lived RS256 access JWTs + single-use refresh tokens with rotation (§10).
 * Refresh tokens are random strings; only their SHA-256 is stored. Re-using a
 * refresh token that was already rotated means it was stolen, so the whole
 * session family is revoked.
 */
@Injectable()
export class TokenService {
  private privateKey!: Promise<CryptoKey>;
  private publicKey!: Promise<CryptoKey>;

  constructor(
    config: ConfigService<Env, true>,
    private readonly db: DatabaseService,
  ) {
    const pem = (b64: string) => Buffer.from(b64, 'base64').toString('utf8');
    this.privateKey = importPKCS8(pem(config.get('JWT_PRIVATE_KEY', { infer: true })), 'RS256');
    this.publicKey = importSPKI(pem(config.get('JWT_PUBLIC_KEY', { infer: true })), 'RS256');
  }

  async issue(user: { id: string; role: Role }, aud: Audience, client: ClientInfo, tx?: Queryable): Promise<IssuedSession> {
    const familyId = randomUUID();
    const refreshToken = await this.storeRefresh(user.id, familyId, aud, client, tx ?? this.db);
    return {
      accessToken: await this.signAccess(user, aud, familyId),
      refreshToken,
      accessExpiresIn: SESSION[aud].accessSeconds,
      refreshExpiresIn: SESSION[aud].refreshSeconds,
      familyId,
    };
  }

  /** Exchanges a refresh token for a new pair. Throws 401 on anything suspicious. */
  async rotate(presented: string, aud: Audience, client: ClientInfo): Promise<IssuedSession & { userId: string }> {
    const expired = new UnauthorizedException('Your session has ended. Please sign in again.');
    type Outcome = null | { reusedFamily: string } | (IssuedSession & { userId: string });
    const result = await this.db.transaction<Outcome>(async (tx) => {
      const { rows } = await tx.query<{
        id: string; user_id: string; family_id: string; expires_at: Date; revoked_at: Date | null;
        audience: Audience; role: Role; status: string;
      }>(
        `SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, rt.revoked_at, rt.audience, u.role, u.status
           FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
          WHERE rt.token_hash = $1
          FOR UPDATE OF rt`,
        [sha256(presented)],
      );
      const row = rows[0];
      if (!row || row.audience !== aud) return null;
      // Reuse of an already-rotated token: assume it was stolen (handled below, outside this transaction).
      if (row.revoked_at) return { reusedFamily: row.family_id };
      if (row.expires_at.getTime() <= Date.now() || row.status !== 'active') return null;
      if (aud === 'admin' && row.role !== 'superadmin') return null;

      const refreshToken = await this.storeRefresh(row.user_id, row.family_id, aud, client, tx, row.id);
      return {
        userId: row.user_id,
        accessToken: await this.signAccess({ id: row.user_id, role: row.role }, aud, row.family_id),
        refreshToken,
        accessExpiresIn: SESSION[aud].accessSeconds,
        refreshExpiresIn: SESSION[aud].refreshSeconds,
        familyId: row.family_id,
      };
    });

    if (!result) throw expired;
    if ('reusedFamily' in result) {
      await this.revokeFamily(result.reusedFamily); // committed on its own, so it sticks
      throw expired;
    }
    return result;
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [familyId]);
  }

  async revokeByToken(presented: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1) AND revoked_at IS NULL`,
      [sha256(presented)],
    );
  }

  async revokeAllForUser(userId: string, tx?: Queryable): Promise<void> {
    await (tx ?? this.db).query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
  }

  async verifyAccess(token: string): Promise<AuthUser & { iat: number }> {
    const { payload } = await jwtVerify(token, await this.publicKey, { issuer: ISSUER, algorithms: ['RS256'] });
    const role = payload.role as Role;
    const aud = payload.aud as Audience;
    if (!payload.sub || !ROLES.includes(role) || (aud !== 'web' && aud !== 'admin') || typeof payload.sid !== 'string') {
      throw new Error('malformed token');
    }
    return { id: payload.sub, role, aud, sid: payload.sid, iat: payload.iat ?? 0 };
  }

  private async signAccess(user: { id: string; role: Role }, aud: Audience, familyId: string) {
    return new SignJWT({ role: user.role, sid: familyId })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(aud)
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION[aud].accessSeconds}s`)
      .sign(await this.privateKey);
  }

  private async storeRefresh(
    userId: string,
    familyId: string,
    aud: Audience,
    client: ClientInfo,
    runner: Queryable,
    replaces?: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    const { rows } = await runner.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, ip, user_agent, audience)
       VALUES ($1, $2, $3, now() + make_interval(secs => $4), $5, $6, $7) RETURNING id`,
      [userId, familyId, sha256(token), SESSION[aud].refreshSeconds, client.ip ?? null, client.userAgent?.slice(0, 500) ?? null, aud],
    );
    if (replaces) {
      await runner.query('UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE id = $1', [replaces, rows[0].id]);
    }
    return token;
  }
}
