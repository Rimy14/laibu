"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Smartphone,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatKes } from "@/lib/brand";
import { ButtonLink } from "@/components/ui/button";

interface PayeeOverviewResponse {
  lifetime_earned: number;
  lifetime_paid: number;
  unallocated_balance: number;
  allocated_pending_balance: number;
  payout_method: {
    type: "mpesa" | "bank" | null;
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
    status: "pending" | "held" | "paid";
    hold_reason: string | null;
    payment_reference: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
}

export default function PayoutsPage() {
  const { user } = useSession();
  const [data, setData] = useState<PayeeOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPayouts() {
      try {
        setLoading(true);
        setError(null);
        const res = await api<PayeeOverviewResponse>("/payouts/me");
        setData(res);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load payout details.");
      } finally {
        setLoading(false);
      }
    }
    if (user) loadPayouts();
  }, [user]);

  const totalNextCycle = (data?.unallocated_balance ?? 0) + (data?.allocated_pending_balance ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-medium tracking-tight">Payouts & Settlements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Settlement cycles run automatically every 2nd and 4th Thursday (EAT) directly to your verified M-Pesa or bank account.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Total Paid Out (Lifetime)
          </span>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-2xl font-serif font-semibold text-emerald-700 dark:text-emerald-300">
              {formatKes(data?.lifetime_paid ?? 0)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-800 dark:text-blue-400">
            Accrued for Next Cycle
          </span>
          <div className="flex items-center gap-2">
            <Wallet className="size-5 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-serif font-semibold text-blue-700 dark:text-blue-300">
              {formatKes(totalNextCycle)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Next Settlement Day
          </span>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            <span className="text-xl font-serif font-semibold">
              {data?.next_payday?.formatted ? (
                new Date(data.next_payday.formatted).toLocaleDateString("en-KE", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              ) : (
                "Upcoming Thursday"
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Payout Method Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-serif font-medium text-base">Receiving Payout Account</h3>
            <p className="text-xs text-muted-foreground">
              Royalties are disbursed automatically to this destination.
            </p>
          </div>
          <ButtonLink
            href="/dashboard/settings"
            variant="outline"
            size="sm"
          >
            Manage Method
            <ArrowRight className="size-3.5 ml-1" />
          </ButtonLink>
        </div>

        {data?.payout_method ? (
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {data.payout_method.type === "mpesa" ? (
                  <Smartphone className="size-5" />
                ) : (
                  <Building2 className="size-5" />
                )}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {data.payout_method.type === "mpesa"
                    ? `M-Pesa Mobile Wallet (ending in ${data.payout_method.account_last4})`
                    : `${data.payout_method.bank_name || "Bank Account"} (ending in ${data.payout_method.account_last4})`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Account Name: <span className="font-mono text-foreground">{data.payout_method.account_name}</span>
                </p>
              </div>
            </div>

            <div>
              {data.payout_method.name_matches ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="size-3.5" /> Name Match Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  <AlertTriangle className="size-3.5" /> Name Mismatch (Hold Risk)
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-sm">
              <AlertTriangle className="size-5 shrink-0" />
              <span>No payout method added. Please configure your M-Pesa or bank account to receive disbursements.</span>
            </div>
            <ButtonLink
              href="/dashboard/settings"
              variant="primary"
              size="sm"
            >
              Add Method
            </ButtonLink>
          </div>
        )}
      </div>

      {/* Statements Table */}
      <div className="space-y-3">
        <h3 className="font-serif font-medium text-lg">Settlement Statements</h3>
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading statements...</div>
        ) : !data || data.statements.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
              <Wallet className="size-6" />
            </div>
            <h4 className="font-serif font-medium text-base">No settlement cycles generated yet</h4>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              When the bi-weekly Thursday payout cycle closes, your formal statements and payment references will be listed here.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border/60 text-xs text-muted-foreground uppercase font-mono">
                  <tr>
                    <th className="px-5 py-3.5">Cycle Date</th>
                    <th className="px-5 py-3.5">Disbursed Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Payment Reference</th>
                    <th className="px-5 py-3.5">Disbursed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {data.statements.map((stmt) => (
                    <tr key={stmt.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-4 font-medium text-foreground">
                        {new Date(stmt.payday).toLocaleDateString("en-KE", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-foreground">
                        {formatKes(stmt.net_amount)}
                      </td>
                      <td className="px-5 py-4 text-xs">
                        {stmt.status === "paid" ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="size-3.5" /> Disbursed
                          </span>
                        ) : stmt.status === "held" ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 font-medium" title={stmt.hold_reason || "Held for review"}>
                            <AlertTriangle className="size-3.5" /> On Hold ({stmt.hold_reason || "Admin Review"})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                            <Clock className="size-3.5" /> Processing
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs">
                        {stmt.payment_reference ? (
                          <span className="bg-muted px-2 py-1 rounded text-foreground font-semibold">
                            {stmt.payment_reference}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Pending Offline Run</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-muted-foreground">
                        {stmt.paid_at ? new Date(stmt.paid_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
