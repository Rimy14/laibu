"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, Clock, CheckCircle2, ShoppingBag, AlertCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatKes } from "@/lib/brand";

interface SaleItem {
  id: string;
  order_id: string;
  book_id: string;
  book_title: string;
  gross: string;
  fee_rate: string;
  fee_amount: string;
  author_royalty_amount: string;
  publisher_margin: string;
  owner_amount: string;
  earned_amount: string;
  payout_status: "unallocated" | "allocated" | "paid";
  created_at: string;
}

interface UserSalesResponse {
  total_sales: number;
  total_gross_kes: number;
  total_earned_kes: number;
  sales: SaleItem[];
}

export default function SalesDashboardPage() {
  const { user } = useSession();
  const [data, setData] = useState<UserSalesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSales() {
      try {
        setLoading(true);
        setError(null);
        const res = await api<UserSalesResponse>("/me/sales");
        setData(res);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load sales reports.");
      } finally {
        setLoading(false);
      }
    }
    if (user) loadSales();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-medium tracking-tight">Sales & Royalties</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track sales in real time, view split calculations, and monitor payout allocation.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Total Copies Sold
          </span>
          <div className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-primary" />
            <span className="text-2xl font-serif font-semibold">{data?.total_sales ?? 0}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs">
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Gross Book Sales
          </span>
          <div className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            <span className="text-2xl font-serif font-semibold">
              {formatKes(data?.total_gross_kes ?? 0)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-5 space-y-1 shadow-xs bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40">
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Your Net Earned Royalties
          </span>
          <div className="flex items-center gap-2">
            <DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-2xl font-serif font-semibold text-emerald-700 dark:text-emerald-300">
              {formatKes(data?.total_earned_kes ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Sales Transactions Table */}
      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading transactions...</div>
      ) : !data || data.sales.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <ShoppingBag className="size-6" />
          </div>
          <h3 className="font-serif font-medium text-lg">No sales recorded yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            When readers purchase your books via M-Pesa, your immutable ledger lines and royalty splits will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs text-muted-foreground uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">Book Title</th>
                  <th className="px-5 py-3.5">Gross (KES)</th>
                  <th className="px-5 py-3.5">Platform Fee</th>
                  <th className="px-5 py-3.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Your Cut (KES)
                  </th>
                  <th className="px-5 py-3.5">Payout Status</th>
                  <th className="px-5 py-3.5">Sale Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {data.sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4 font-medium text-foreground">
                      {sale.book_title}
                    </td>
                    <td className="px-5 py-4 font-mono">{formatKes(parseFloat(sale.gross))}</td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {sale.fee_rate}% ({formatKes(parseFloat(sale.fee_amount))})
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatKes(parseFloat(sale.earned_amount))}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {sale.payout_status === "paid" ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="size-3.5" /> Paid
                        </span>
                      ) : sale.payout_status === "allocated" ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                          <Clock className="size-3.5" /> Scheduled for Thursday
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Awaiting Payout Cycle</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">
                      {new Date(sale.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
