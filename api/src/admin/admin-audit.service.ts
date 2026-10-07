import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class AdminAuditService {
  constructor(private readonly db: DatabaseService) {}

  async listAuditLogs(limit = 100, offset = 0) {
    const { rows } = await this.db.query<{
      id: string;
      actor_id: string | null;
      actor_role: string | null;
      actor_name: string | null;
      actor_email: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      metadata: any;
      ip: string | null;
      created_at: string;
    }>(
      `SELECT a.id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id,
              a.metadata, a.ip, a.created_at,
              u.full_name AS actor_name, u.email AS actor_email
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.actor_id
        ORDER BY a.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM audit_log`,
    );

    return {
      total: Number(countRows[0]?.count || 0),
      logs: rows,
    };
  }

  async listSecurityEvents(limit = 100, offset = 0) {
    const { rows } = await this.db.query<{
      id: string;
      user_id: string | null;
      user_name: string | null;
      user_email: string | null;
      book_id: string | null;
      book_title: string | null;
      event_type: string;
      page: string | null;
      device_label: string | null;
      ip: string | null;
      user_agent: string | null;
      created_at: string;
    }>(
      `SELECT se.id, se.user_id, se.event_type, se.page, se.device_label, se.ip, se.user_agent, se.created_at,
              u.full_name AS user_name, u.email AS user_email,
              b.title AS book_title
         FROM security_events se
         LEFT JOIN users u ON u.id = se.user_id
         LEFT JOIN books b ON b.id = se.book_id
        ORDER BY se.created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    const { rows: countRows } = await this.db.query<{ count: string }>(
      `SELECT count(*)::int AS count FROM security_events`,
    );

    return {
      total: Number(countRows[0]?.count || 0),
      events: rows,
    };
  }
}
