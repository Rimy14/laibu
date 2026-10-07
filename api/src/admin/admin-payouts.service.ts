import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { AuditService } from '../common/audit/audit.service.js';
import { EmailService } from '../email/email.service.js';
import type { AuthUser } from '../common/auth/auth.types.js';
import { PayoutsService } from '../payouts/payouts.service.js';

@Injectable()
export class AdminPayoutsService {
  private readonly logger = new Logger(AdminPayoutsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldEncryptionService,
    private readonly audit: AuditService,
    private readonly emailService: EmailService,
    private readonly payoutsService: PayoutsService,
  ) {}

  async listCycles() {
    const { rows } = await this.db.query<{
      id: string;
      payday: string;
      window_start: string;
      window_end: string;
      status: string;
      generated_at: string | null;
      completed_at: string | null;
      created_at: string;
      total_amount: string;
      total_lines: string;
      paid_lines: string;
      pending_lines: string;
      held_lines: string;
    }>(
      `SELECT pc.id, to_char(pc.payday, 'YYYY-MM-DD') AS payday, pc.window_start, pc.window_end, pc.status,
              pc.generated_at, pc.completed_at, pc.created_at,
              COALESCE(SUM(prl.net_amount), 0)::numeric(12,2) AS total_amount,
              COUNT(prl.id)::int AS total_lines,
              COUNT(prl.id) FILTER (WHERE prl.status = 'paid')::int AS paid_lines,
              COUNT(prl.id) FILTER (WHERE prl.status = 'pending')::int AS pending_lines,
              COUNT(prl.id) FILTER (WHERE prl.status = 'held')::int AS held_lines
         FROM payout_cycles pc
         LEFT JOIN payout_report_lines prl ON prl.cycle_id = pc.id
        GROUP BY pc.id
        ORDER BY pc.payday DESC`,
    );

    return rows.map((r) => ({
      ...r,
      total_amount: parseFloat(r.total_amount),
      total_lines: Number(r.total_lines),
      paid_lines: Number(r.paid_lines),
      pending_lines: Number(r.pending_lines),
      held_lines: Number(r.held_lines),
    }));
  }

  async getCycleDetails(cycleId: string) {
    const { rows: cycleRows } = await this.db.query<{
      id: string;
      payday: string;
      window_start: string;
      window_end: string;
      status: string;
      generated_at: string | null;
      completed_at: string | null;
      created_at: string;
    }>(
      `SELECT id, to_char(payday, 'YYYY-MM-DD') AS payday, window_start, window_end, status,
              generated_at, completed_at, created_at
         FROM payout_cycles
        WHERE id = $1`,
      [cycleId],
    );

    if (cycleRows.length === 0) {
      throw new NotFoundException('Payout cycle not found');
    }

    const cycle = cycleRows[0];

    const { rows: lineRows } = await this.db.query<{
      id: string;
      payee_id: string;
      full_name: string;
      email: string;
      role: string;
      net_amount: string;
      method_snapshot: any;
      name_match: boolean;
      status: 'pending' | 'held' | 'paid';
      hold_reason: string | null;
      payment_reference: string | null;
      paid_at: string | null;
      paid_by: string | null;
      created_at: string;
      mpesa_phone_enc: Buffer | null;
      bank_account_enc: Buffer | null;
    }>(
      `SELECT prl.id, prl.payee_id, u.full_name, u.email, u.role,
              prl.net_amount, prl.method_snapshot, prl.name_match, prl.status,
              prl.hold_reason, prl.payment_reference, prl.paid_at, prl.paid_by,
              prl.created_at, pm.mpesa_phone_enc, pm.bank_account_enc
         FROM payout_report_lines prl
         JOIN users u ON u.id = prl.payee_id
         LEFT JOIN payout_methods pm ON pm.user_id = u.id
        WHERE prl.cycle_id = $1
        ORDER BY prl.status ASC, prl.net_amount DESC`,
      [cycleId],
    );

    // Fetch line items breakdown for each line
    const { rows: itemRows } = await this.db.query<{
      payout_line_id: string;
      ledger_id: string;
      payee_role: string;
      amount: string;
      book_title: string;
      gross: string;
    }>(
      `SELECT pli.payout_line_id, pli.ledger_id, pli.payee_role, pli.amount,
              b.title AS book_title, sl.gross
         FROM payout_line_items pli
         JOIN sales_ledger sl ON sl.id = pli.ledger_id
         JOIN books b ON b.id = sl.book_id
        WHERE pli.payout_line_id = ANY($1::uuid[])`,
      [lineRows.map((l) => l.id)],
    );

    const itemsByLine = new Map<string, any[]>();
    for (const item of itemRows) {
      const list = itemsByLine.get(item.payout_line_id) || [];
      list.push({
        ledger_id: item.ledger_id,
        payee_role: item.payee_role,
        amount: parseFloat(item.amount),
        book_title: item.book_title,
        gross: parseFloat(item.gross),
      });
      itemsByLine.set(item.payout_line_id, list);
    }

    const lines = lineRows.map((line) => {
      let decryptedAccount: string | null = null;
      if (line.method_snapshot?.type === 'mpesa' && line.mpesa_phone_enc) {
        try {
          decryptedAccount = this.crypto.decrypt(line.mpesa_phone_enc, line.payee_id);
        } catch {
          decryptedAccount = null;
        }
      } else if (line.method_snapshot?.type === 'bank' && line.bank_account_enc) {
        try {
          decryptedAccount = this.crypto.decrypt(line.bank_account_enc, line.payee_id);
        } catch {
          decryptedAccount = null;
        }
      }

      return {
        id: line.id,
        payee: {
          id: line.payee_id,
          full_name: line.full_name,
          email: line.email,
          role: line.role,
        },
        net_amount: parseFloat(line.net_amount),
        method_snapshot: line.method_snapshot,
        decrypted_account: decryptedAccount,
        name_match: line.name_match,
        status: line.status,
        hold_reason: line.hold_reason,
        payment_reference: line.payment_reference,
        paid_at: line.paid_at,
        created_at: line.created_at,
        items: itemsByLine.get(line.id) || [],
      };
    });

    return {
      cycle,
      lines,
    };
  }

  async markLinePaid(lineId: string, paymentReference: string, adminUser: AuthUser, req: Request) {
    const trimmedRef = paymentReference?.trim();
    if (!trimmedRef) {
      throw new BadRequestException('A valid payment reference (M-Pesa code or Bank transaction ID) is required.');
    }

    return this.db.transaction(async (tx) => {
      const { rows: lineRows } = await tx.query<{
        id: string;
        cycle_id: string;
        payee_id: string;
        net_amount: string;
        status: string;
        method_snapshot: any;
        payday: string;
        full_name: string;
        email: string;
      }>(
        `SELECT prl.id, prl.cycle_id, prl.payee_id, prl.net_amount, prl.status, prl.method_snapshot,
                to_char(pc.payday, 'DD Mon YYYY') AS payday, u.full_name, u.email
           FROM payout_report_lines prl
           JOIN payout_cycles pc ON pc.id = prl.cycle_id
           JOIN users u ON u.id = prl.payee_id
          WHERE prl.id = $1
          FOR UPDATE`,
        [lineId],
      );

      if (lineRows.length === 0) {
        throw new NotFoundException('Payout line not found');
      }

      const line = lineRows[0];
      if (line.status === 'paid') {
        throw new BadRequestException('This payout line is already marked as paid.');
      }

      // Update payout_report_lines
      await tx.query(
        `UPDATE payout_report_lines
            SET status = 'paid',
                payment_reference = $1,
                paid_at = now(),
                paid_by = $2,
                hold_reason = null
          WHERE id = $3`,
        [trimmedRef, adminUser.id, lineId],
      );

      // Lock linked sales ledger entries
      const { rows: itemRows } = await tx.query<{ ledger_id: string }>(
        `SELECT ledger_id FROM payout_line_items WHERE payout_line_id = $1`,
        [lineId],
      );

      const ledgerIds = itemRows.map((i) => i.ledger_id);
      if (ledgerIds.length > 0) {
        await tx.query(
          `UPDATE sales_ledger
              SET paid_at = now()
            WHERE id = ANY($1::bigint[])
              AND paid_at IS NULL`,
          [ledgerIds],
        );
      }

      // Check if all lines in this cycle are now paid
      const { rows: pendingRemaining } = await tx.query<{ count: string }>(
        `SELECT count(*)::int AS count
           FROM payout_report_lines
          WHERE cycle_id = $1 AND status <> 'paid'`,
        [line.cycle_id],
      );

      if (Number(pendingRemaining[0]?.count || 0) === 0) {
        await tx.query(
          `UPDATE payout_cycles
              SET status = 'completed', completed_at = now()
            WHERE id = $1`,
          [line.cycle_id],
        );
      }

      // Audit log
      await this.audit.record(
        req,
        {
          action: 'payout.mark_paid',
          entityType: 'payout_line',
          entityId: lineId,
          metadata: {
            cycle_id: line.cycle_id,
            payee_id: line.payee_id,
            net_amount: line.net_amount,
            payment_reference: trimmedRef,
          },
        },
        tx,
      );

      // Trigger asynchronous email notification
      const methodLabel = line.method_snapshot?.type === 'mpesa'
        ? `M-Pesa (ending in ${line.method_snapshot.account_last4})`
        : line.method_snapshot?.bank_name
        ? `${line.method_snapshot.bank_name} (ending in ${line.method_snapshot.account_last4})`
        : 'Registered Payout Method';

      this.emailService
        .sendPayoutDisbursed({
          toEmail: line.email,
          recipientName: line.full_name,
          netAmountKes: parseFloat(line.net_amount),
          paymentReference: trimmedRef,
          payoutMethodLabel: methodLabel,
          paydayFormatted: line.payday,
        })
        .catch((err) => this.logger.error(`Failed to dispatch payout email to ${line.email}: ${err.message}`));

      return {
        id: lineId,
        status: 'paid',
        payment_reference: trimmedRef,
        paid_at: new Date().toISOString(),
      };
    });
  }

  async toggleLineHold(lineId: string, hold: boolean, holdReason: string | undefined, adminUser: AuthUser, req: Request) {
    return this.db.transaction(async (tx) => {
      const { rows: lineRows } = await tx.query<{ id: string; cycle_id: string; status: string }>(
        `SELECT id, cycle_id, status FROM payout_report_lines WHERE id = $1 FOR UPDATE`,
        [lineId],
      );

      if (lineRows.length === 0) {
        throw new NotFoundException('Payout line not found');
      }

      const line = lineRows[0];
      if (line.status === 'paid') {
        throw new BadRequestException('Cannot hold a line that is already paid.');
      }

      const newStatus = hold ? 'held' : 'pending';
      const reason = hold ? (holdReason?.trim() || 'Held for admin review') : null;

      await tx.query(
        `UPDATE payout_report_lines
            SET status = $1, hold_reason = $2
          WHERE id = $3`,
        [newStatus, reason, lineId],
      );

      await this.audit.record(
        req,
        {
          action: hold ? 'payout.hold' : 'payout.unhold',
          entityType: 'payout_line',
          entityId: lineId,
          metadata: { reason },
        },
        tx,
      );

      return {
        id: lineId,
        status: newStatus,
        hold_reason: reason,
      };
    });
  }

  async triggerCycleGeneration(targetPaydayDateStr: string | undefined, adminUser: AuthUser, req: Request) {
    const res = await this.payoutsService.generateCycle(targetPaydayDateStr);

    await this.audit.record(
      req,
      {
        action: 'payout.generate_cycle',
        entityType: 'payout_cycle',
        entityId: res.cycle_id,
        metadata: { ...res },
      },
    );

    return res;
  }
}
