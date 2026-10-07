import { Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService, type Queryable } from '../../database/database.service.js';

export interface AuditEntry {
  action: string; // e.g. "book.approve", "payout.mark_paid"
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit trail (§10). Pass the transaction client when the audited
 * change runs in a transaction, so the change and its audit row commit together.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  async record(req: Request, entry: AuditEntry, tx?: Queryable): Promise<void> {
    const runner = tx ?? this.db;
    await runner.query(
      `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, metadata, ip, user_agent, request_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        req.user?.id ?? null,
        req.user?.role ?? null,
        entry.action,
        entry.entityType ?? null,
        entry.entityId ?? null,
        JSON.stringify(entry.metadata ?? {}),
        req.ip ?? null,
        req.get('user-agent')?.slice(0, 500) ?? null,
        req.requestId ?? null,
      ],
    );
    this.logger.log(`${entry.action} by ${req.user?.id ?? 'anonymous'} [${req.requestId}]`);
  }
}
