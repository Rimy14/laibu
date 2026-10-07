import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { FieldEncryptionService } from '../common/crypto/field-encryption.service.js';
import { cleanName } from '../auth/users.js';
import { nairobiDate, nthThursday, paydayWindowEnd, upcomingPaydays } from './payday.js';

export interface PayeeEarningsOverview {
  lifetime_earned: number;
  lifetime_paid: number;
  unallocated_balance: number;
  allocated_pending_balance: number;
  payout_method: {
    type: 'mpesa' | 'bank' | null;
    account_name: string | null;
    bank_name: string | null;
    bank_branch: string | null;
    account_last4: string | null;
    name_matches: boolean;
  } | null;
  next_payday: {
    year: number;
    month: number;
    day: number;
    formatted: string;
  };
  statements: Array<{
    id: string;
    cycle_id: string;
    payday: string;
    net_amount: number;
    status: 'pending' | 'held' | 'paid';
    hold_reason: string | null;
    payment_reference: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
}

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  /**
   * Retrieves full payout overview for author/publisher dashboard
   */
  async getPayeeEarningsOverview(userId: string): Promise<PayeeEarningsOverview> {
    const nextPaydayDate = upcomingPaydays(new Date(), 1)[0];
    const formattedNext = `${nextPaydayDate.year}-${String(nextPaydayDate.month).padStart(2, '0')}-${String(nextPaydayDate.day).padStart(2, '0')}`;

    // 1. Fetch user's payout method
    const { rows: pmRows } = await this.db.query<{
      type: 'mpesa' | 'bank';
      account_name: string;
      bank_name: string | null;
      bank_branch: string | null;
      account_last4: string;
      full_name: string;
    }>(
      `SELECT pm.type, pm.account_name, pm.bank_name, pm.bank_branch, pm.account_last4, u.full_name
         FROM users u
         LEFT JOIN payout_methods pm ON pm.user_id = u.id
        WHERE u.id = $1`,
      [userId],
    );

    const userProfile = pmRows[0];
    let payoutMethod = null;
    if (userProfile && userProfile.type) {
      const nameMatches = cleanName(userProfile.account_name || '').toLowerCase() === cleanName(userProfile.full_name || '').toLowerCase();
      payoutMethod = {
        type: userProfile.type,
        account_name: userProfile.account_name,
        bank_name: userProfile.bank_name,
        bank_branch: userProfile.bank_branch,
        account_last4: userProfile.account_last4,
        name_matches: nameMatches,
      };
    }

    // 2. Fetch financial ledger aggregates for this user
    const { rows: ledgerRows } = await this.db.query<{
      owner_amount: string;
      author_royalty_amount: string;
      publisher_margin: string;
      is_publisher_sale: boolean;
      author_id: string;
      publisher_id: string;
      owner_id: string;
      payout_cycle_id: string | null;
      paid_at: string | null;
    }>(
      `SELECT sl.owner_amount, sl.author_royalty_amount, sl.publisher_margin,
              sl.is_publisher_sale, sl.author_id, sl.publisher_id, sl.owner_id,
              sl.payout_cycle_id, sl.paid_at
         FROM sales_ledger sl
        WHERE (NOT sl.is_publisher_sale AND sl.owner_id = $1)
           OR (sl.is_publisher_sale AND (sl.author_id = $1 OR sl.publisher_id = $1))`,
      [userId],
    );

    let lifetimeEarned = 0;
    let lifetimePaid = 0;
    let unallocatedBalance = 0;
    let allocatedPendingBalance = 0;

    for (const row of ledgerRows) {
      let cut = 0;
      if (!row.is_publisher_sale && row.owner_id === userId) {
        cut = parseFloat(row.owner_amount);
      } else if (row.is_publisher_sale) {
        if (row.author_id === userId) {
          cut += parseFloat(row.author_royalty_amount);
        }
        if (row.publisher_id === userId) {
          cut += parseFloat(row.publisher_margin);
        }
      }

      lifetimeEarned += cut;
      if (row.paid_at) {
        lifetimePaid += cut;
      } else if (!row.payout_cycle_id) {
        unallocatedBalance += cut;
      } else {
        allocatedPendingBalance += cut;
      }
    }

    // 3. Fetch past statements / report lines
    const { rows: statements } = await this.db.query<{
      id: string;
      cycle_id: string;
      payday: string;
      net_amount: string;
      status: 'pending' | 'held' | 'paid';
      hold_reason: string | null;
      payment_reference: string | null;
      paid_at: string | null;
      created_at: string;
    }>(
      `SELECT prl.id, prl.cycle_id, to_char(pc.payday, 'YYYY-MM-DD') AS payday,
              prl.net_amount, prl.status, prl.hold_reason, prl.payment_reference,
              prl.paid_at, prl.created_at
         FROM payout_report_lines prl
         JOIN payout_cycles pc ON pc.id = prl.cycle_id
        WHERE prl.payee_id = $1
        ORDER BY pc.payday DESC, prl.created_at DESC`,
      [userId],
    );

    return {
      lifetime_earned: Number(lifetimeEarned.toFixed(2)),
      lifetime_paid: Number(lifetimePaid.toFixed(2)),
      unallocated_balance: Number(unallocatedBalance.toFixed(2)),
      allocated_pending_balance: Number(allocatedPendingBalance.toFixed(2)),
      payout_method: payoutMethod,
      next_payday: {
        ...nextPaydayDate,
        formatted: formattedNext,
      },
      statements: statements.map((s) => ({
        ...s,
        net_amount: parseFloat(s.net_amount),
      })),
    };
  }

  /**
   * Generates or syncs a payout cycle for a target Thursday
   */
  async generateCycle(targetPaydayDateStr?: string) {
    let paydayDate: { year: number; month: number; day: number };

    if (targetPaydayDateStr) {
      const parts = targetPaydayDateStr.split('-').map(Number);
      if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
        throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
      }
      paydayDate = { year: parts[0], month: parts[1], day: parts[2] };
    } else {
      paydayDate = upcomingPaydays(new Date(), 1)[0];
    }

    const paydaySqlStr = `${paydayDate.year}-${String(paydayDate.month).padStart(2, '0')}-${String(paydayDate.day).padStart(2, '0')}`;
    const windowEnd = paydayWindowEnd(paydayDate);

    return this.db.transaction(async (tx) => {
      // Find previous cycle end to establish window_start
      const { rows: prevCycle } = await tx.query<{ window_end: string }>(
        `SELECT window_end FROM payout_cycles WHERE payday < $1 ORDER BY payday DESC LIMIT 1`,
        [paydaySqlStr],
      );
      const windowStart = prevCycle[0]?.window_end ? new Date(prevCycle[0].window_end) : new Date(0);

      // Create or retrieve cycle
      const { rows: cycleRows } = await tx.query<{
        id: string;
        payday: string;
        window_start: string;
        window_end: string;
        status: string;
      }>(
        `INSERT INTO payout_cycles (payday, window_start, window_end, status, generated_at)
         VALUES ($1, $2, $3, 'generated', now())
         ON CONFLICT (payday) DO UPDATE SET generated_at = now()
         RETURNING id, payday, window_start, window_end, status`,
        [paydaySqlStr, windowStart.toISOString(), windowEnd.toISOString()],
      );

      const cycle = cycleRows[0];

      // Fetch unallocated ledger entries up to windowEnd
      const { rows: unallocatedLedger } = await tx.query<{
        id: string;
        gross: string;
        fee_amount: string;
        is_publisher_sale: boolean;
        author_id: string;
        publisher_id: string | null;
        owner_id: string | null;
        author_royalty_amount: string;
        publisher_margin: string;
        owner_amount: string;
      }>(
        `SELECT sl.id, sl.gross, sl.fee_amount, sl.is_publisher_sale,
                sl.author_id, sl.publisher_id, sl.owner_id,
                sl.author_royalty_amount, sl.publisher_margin, sl.owner_amount
           FROM sales_ledger sl
          WHERE sl.payout_cycle_id IS NULL
            AND sl.created_at < $1
          ORDER BY sl.id ASC
          FOR UPDATE`,
        [windowEnd.toISOString()],
      );

      if (unallocatedLedger.length === 0) {
        return {
          cycle_id: cycle.id,
          payday: paydaySqlStr,
          lines_generated: 0,
          total_gross: 0,
          total_net: 0,
          message: 'No unallocated sales ledger lines found for this earning window.',
        };
      }

      // Group by payee
      interface PayeeAccumulator {
        payeeId: string;
        netAmount: number;
        items: Array<{
          ledgerId: string;
          payeeRole: 'author' | 'publisher' | 'owner';
          amount: number;
        }>;
      }

      const payeeMap = new Map<string, PayeeAccumulator>();

      for (const row of unallocatedLedger) {
        if (!row.is_publisher_sale && row.owner_id) {
          const ownerAmt = parseFloat(row.owner_amount);
          if (ownerAmt > 0) {
            const acc = payeeMap.get(row.owner_id) || { payeeId: row.owner_id, netAmount: 0, items: [] };
            acc.netAmount += ownerAmt;
            acc.items.push({ ledgerId: row.id, payeeRole: 'owner', amount: ownerAmt });
            payeeMap.set(row.owner_id, acc);
          }
        } else if (row.is_publisher_sale) {
          const authAmt = parseFloat(row.author_royalty_amount);
          if (authAmt > 0) {
            const acc = payeeMap.get(row.author_id) || { payeeId: row.author_id, netAmount: 0, items: [] };
            acc.netAmount += authAmt;
            acc.items.push({ ledgerId: row.id, payeeRole: 'author', amount: authAmt });
            payeeMap.set(row.author_id, acc);
          }

          if (row.publisher_id) {
            const pubAmt = parseFloat(row.publisher_margin);
            if (pubAmt > 0) {
              const acc = payeeMap.get(row.publisher_id) || { payeeId: row.publisher_id, netAmount: 0, items: [] };
              acc.netAmount += pubAmt;
              acc.items.push({ ledgerId: row.id, payeeRole: 'publisher', amount: pubAmt });
              payeeMap.set(row.publisher_id, acc);
            }
          }
        }
      }

      let totalNet = 0;
      let totalLinesCount = 0;

      for (const [payeeId, acc] of payeeMap.entries()) {
        if (acc.netAmount <= 0) continue;

        // Fetch user and payout method
        const { rows: userRows } = await tx.query<{
          full_name: string;
          email: string;
          role: string;
          type: 'mpesa' | 'bank' | null;
          account_name: string | null;
          bank_name: string | null;
          bank_branch: string | null;
          account_last4: string | null;
        }>(
          `SELECT u.full_name, u.email, u.role,
                  pm.type, pm.account_name, pm.bank_name, pm.bank_branch, pm.account_last4
             FROM users u
             LEFT JOIN payout_methods pm ON pm.user_id = u.id
            WHERE u.id = $1`,
          [payeeId],
        );

        const u = userRows[0];
        if (!u) continue;

        const nameMatch = Boolean(
          u.account_name && cleanName(u.account_name).toLowerCase() === cleanName(u.full_name).toLowerCase(),
        );

        let initialStatus: 'pending' | 'held' = 'pending';
        let holdReason: string | null = null;

        if (!u.type) {
          initialStatus = 'held';
          holdReason = 'No payout method configured';
        } else if (!nameMatch) {
          initialStatus = 'held';
          holdReason = 'Payout account name does not match registered user name';
        }

        const methodSnapshot = u.type
          ? {
              type: u.type,
              account_name: u.account_name,
              bank_name: u.bank_name,
              bank_branch: u.bank_branch,
              account_last4: u.account_last4,
            }
          : null;

        // Insert report line
        const { rows: lineRows } = await tx.query<{ id: string }>(
          `INSERT INTO payout_report_lines (cycle_id, payee_id, net_amount, method_snapshot, name_match, status, hold_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (cycle_id, payee_id) DO UPDATE SET
             net_amount = EXCLUDED.net_amount,
             method_snapshot = EXCLUDED.method_snapshot,
             name_match = EXCLUDED.name_match
           RETURNING id`,
          [
            cycle.id,
            payeeId,
            acc.netAmount.toFixed(2),
            methodSnapshot ? JSON.stringify(methodSnapshot) : null,
            nameMatch,
            initialStatus,
            holdReason,
          ],
        );

        const lineId = lineRows[0].id;

        // Insert line items
        for (const item of acc.items) {
          await tx.query(
            `INSERT INTO payout_line_items (payout_line_id, ledger_id, payee_role, amount)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (payout_line_id, ledger_id, payee_role) DO NOTHING`,
            [lineId, item.ledgerId, item.payeeRole, item.amount.toFixed(2)],
          );
        }

        totalNet += acc.netAmount;
        totalLinesCount++;
      }

      // Mark all these ledger rows with payout_cycle_id
      const ledgerIds = unallocatedLedger.map((l) => l.id);
      await tx.query(
        `UPDATE sales_ledger SET payout_cycle_id = $1 WHERE id = ANY($2::bigint[])`,
        [cycle.id, ledgerIds],
      );

      return {
        cycle_id: cycle.id,
        payday: paydaySqlStr,
        lines_generated: totalLinesCount,
        ledger_entries_allocated: ledgerIds.length,
        total_net: Number(totalNet.toFixed(2)),
      };
    });
  }
}
