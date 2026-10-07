import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Audience, Role } from '../common/auth/auth.types.js';
import { DatabaseService } from '../database/database.service.js';
import { TermsService } from '../terms/terms.service.js';
import { burnPasswordCheck, hashPassword, passwordProblem, verifyPassword } from './password.js';
import { TokenService, type IssuedSession } from './token.service.js';
import { cleanEmail, cleanName, normaliseKenyanMobile, PUBLIC_USER_COLUMNS, type PublicUser } from './users.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const INVALID = 'The email or password is incorrect.';

interface Client {
  ip?: string;
  userAgent?: string;
}

export interface AuthResult {
  user: PublicUser;
  terms_current: boolean;
  session: IssuedSession;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly tokens: TokenService,
    private readonly terms: TermsService,
  ) {}

  /** §5.1 signup: account + terms acceptance (with IP/UA evidence) in one transaction. */
  async signup(
    input: {
      role: Exclude<Role, 'superadmin'>;
      full_name: string;
      email: string;
      phone?: string;
      password: string;
      accept_terms_version: string;
      accept_policy_version: string;
    },
    client: Client,
  ): Promise<AuthResult> {
    const email = cleanEmail(input.email);
    const fullName = cleanName(input.full_name);
    const problem = passwordProblem(input.password, { email, fullName });
    if (problem) throw new UnprocessableEntityException(problem);

    let phone: string | null = null;
    if (input.phone?.trim()) {
      phone = normaliseKenyanMobile(input.phone);
      if (!phone) throw new UnprocessableEntityException('Enter a Kenyan mobile number, e.g. 0712 345 678.');
    }

    const passwordHash = await hashPassword(input.password);

    return this.db.transaction(async (tx) => {
      const exists = await tx.query('SELECT 1 FROM users WHERE lower(email) = $1', [email]);
      if (exists.rowCount) throw new ConflictException('An account with this email already exists. Try signing in instead.');

      const { rows } = await tx.query<PublicUser>(
        `INSERT INTO users (role, full_name, email, phone, password_hash, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, now()) RETURNING ${PUBLIC_USER_COLUMNS}`,
        [input.role, fullName, email, phone, passwordHash],
      );
      const user = rows[0];
      await this.terms.accept(
        user.id,
        { termsVersion: input.accept_terms_version, policyVersion: input.accept_policy_version },
        client,
        tx,
      );
      const session = await this.tokens.issue(user, 'web', client, tx);
      return { user, terms_current: true, session };
    });
  }

  /**
   * Shared by the public and admin sign-in. Each door only opens for its own
   * roles, and both give the same generic error, so neither reveals whether
   * an email belongs to an admin.
   */
  async login(emailInput: string, password: string, aud: Audience, client: Client): Promise<AuthResult> {
    const email = cleanEmail(emailInput);
    const { rows } = await this.db.query<{
      id: string; role: Role; status: string; password_hash: string;
      failed_login_count: number; locked_until: Date | null;
    }>(
      'SELECT id, role, status, password_hash, failed_login_count, locked_until FROM users WHERE lower(email) = $1',
      [email],
    );
    const account = rows[0];
    const rightDoor = account && (aud === 'admin' ? account.role === 'superadmin' : account.role !== 'superadmin');

    if (!account || !rightDoor) {
      await burnPasswordCheck(password);
      throw new UnauthorizedException(INVALID);
    }

    if (account.locked_until && account.locked_until.getTime() > Date.now()) {
      const mins = Math.ceil((account.locked_until.getTime() - Date.now()) / 60_000);
      throw new HttpException(
        `Too many failed attempts. For your security, try again in ${mins} minute${mins === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!(await verifyPassword(account.password_hash, password))) {
      const failures = account.failed_login_count + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await this.db.query(
        `UPDATE users SET failed_login_count = $2,
                locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) ELSE locked_until END
          WHERE id = $1`,
        [account.id, lock ? 0 : failures, lock, LOCK_MINUTES],
      );
      if (lock) this.logger.warn(`Account ${account.id} locked after ${MAX_FAILED_LOGINS} failed sign-ins (ip ${client.ip})`);
      throw new UnauthorizedException(
        lock ? `Too many failed attempts. For your security, try again in ${LOCK_MINUTES} minutes.` : INVALID,
      );
    }

    if (account.status !== 'active') {
      throw new ForbiddenException('This account is suspended. Please contact support.');
    }

    return this.db.transaction(async (tx) => {
      const { rows: updated } = await tx.query<PublicUser>(
        `UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = now()
          WHERE id = $1 RETURNING ${PUBLIC_USER_COLUMNS}`,
        [account.id],
      );
      const user = updated[0];
      const session = await this.tokens.issue(user, aud, client, tx);
      const terms_current = aud === 'admin' ? true : await this.terms.isCurrent(user.id, tx);
      return { user, terms_current, session };
    });
  }

  async profile(userId: string): Promise<PublicUser> {
    const { rows } = await this.db.query<PublicUser>(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = $1`, [userId]);
    if (!rows[0]) throw new UnauthorizedException('Please sign in to continue.');
    return rows[0];
  }

  async checkPassword(userId: string, password: string): Promise<boolean> {
    const { rows } = await this.db.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
    return rows[0] ? verifyPassword(rows[0].password_hash, password) : false;
  }
}
