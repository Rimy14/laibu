import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService, type Queryable } from '../database/database.service.js';

export type TermsDoc = 'terms_of_use' | 'privacy_policy';

export interface TermsVersion {
  id: string;
  doc: TermsDoc;
  version: string;
  title: string;
  content_md: string;
  published_at: Date;
}

/** §9 terms acceptance gate. */
@Injectable()
export class TermsService {
  constructor(private readonly db: DatabaseService) {}

  async current(): Promise<Record<TermsDoc, TermsVersion>> {
    const { rows } = await this.db.query<TermsVersion>(
      'SELECT id, doc, version, title, content_md, published_at FROM terms_versions WHERE is_current',
    );
    const byDoc = Object.fromEntries(rows.map((r) => [r.doc, r])) as Partial<Record<TermsDoc, TermsVersion>>;
    if (!byDoc.terms_of_use || !byDoc.privacy_policy) {
      throw new Error('No current Terms of Use / Privacy Policy published. Run the seed or publish them in the admin panel.');
    }
    return byDoc as Record<TermsDoc, TermsVersion>;
  }

  /** True when the user has accepted every current document. */
  async isCurrent(userId: string, runner: Queryable = this.db): Promise<boolean> {
    const { rows } = await runner.query(
      `SELECT NOT EXISTS (
         SELECT 1 FROM terms_versions tv
          WHERE tv.is_current
            AND NOT EXISTS (SELECT 1 FROM user_terms_acceptances a
                             WHERE a.user_id = $1 AND a.terms_version_id = tv.id)
       ) AS current`,
      [userId],
    );
    return rows[0].current as boolean;
  }

  /**
   * Records acceptance of the versions the user actually saw. If either
   * changed in the meantime, refuse, so the user re-reads the new text.
   */
  async accept(
    userId: string,
    seen: { termsVersion: string; policyVersion: string },
    client: { ip?: string; userAgent?: string },
    runner: Queryable = this.db,
  ): Promise<void> {
    const current = await this.current();
    if (current.terms_of_use.version !== seen.termsVersion || current.privacy_policy.version !== seen.policyVersion) {
      throw new BadRequestException('The terms were updated while you were reading. Please review the latest version.');
    }
    await runner.query(
      `INSERT INTO user_terms_acceptances (user_id, terms_version_id, ip, user_agent)
       SELECT $1, unnest($2::uuid[]), $3, $4
       ON CONFLICT (user_id, terms_version_id) DO NOTHING`,
      [userId, [current.terms_of_use.id, current.privacy_policy.id], client.ip ?? null, client.userAgent?.slice(0, 500) ?? null],
    );
  }

  async list() {
    const { rows } = await this.db.query(
      `SELECT tv.id, tv.doc, tv.version, tv.title, tv.is_current, tv.published_at,
              (SELECT count(*)::int FROM user_terms_acceptances a WHERE a.terms_version_id = tv.id) AS acceptances
         FROM terms_versions tv ORDER BY tv.published_at DESC`,
    );
    return rows;
  }

  /** Publishes a new version and makes it current; every user must re-accept. */
  async publish(doc: TermsDoc, input: { version: string; title: string; content_md: string }, adminId: string, tx: Queryable) {
    await tx.query('UPDATE terms_versions SET is_current = false WHERE doc = $1 AND is_current', [doc]);
    const { rows } = await tx.query(
      `INSERT INTO terms_versions (doc, version, title, content_md, is_current, created_by)
       VALUES ($1, $2, $3, $4, true, $5) RETURNING id, doc, version, title, published_at`,
      [doc, input.version, input.title, input.content_md, adminId],
    );
    return rows[0];
  }
}
