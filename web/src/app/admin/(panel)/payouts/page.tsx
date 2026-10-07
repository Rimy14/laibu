"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import {
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  Eye,
  Check,
  PauseCircle,
  PlayCircle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatKes } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

interface PayoutCycleSummary {
  id: string;
  payday: string;
  window_start: string;
  window_end: string;
  status: string;
  generated_at: string | null;
  completed_at: string | null;
  total_amount: number;
  total_lines: number;
  paid_lines: number;
  pending_lines: number;
  held_lines: number;
}

interface PayoutLineItem {
  ledger_id: string;
  payee_role: string;
  amount: number;
  book_title: string;
  gross: number;
}

interface PayoutReportLine {
  id: string;
  payee: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  net_amount: number;
  method_snapshot: {
    type: "mpesa" | "bank";
    account_name: string;
    bank_name: string | null;
    bank_branch: string | null;
    account_last4: string;
  } | null;
  decrypted_account: string | null;
  name_match: boolean;
  status: "pending" | "held" | "paid";
  hold_reason: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  created_at: string;
  items: PayoutLineItem[];
}

interface CycleDetailsResponse {
  cycle: {
    id: string;
    payday: string;
    window_start: string;
    window_end: string;
    status: string;
    generated_at: string | null;
    completed_at: string | null;
  };
  lines: PayoutReportLine[];
}

export default function AdminPayoutsPage() {
  const [cycles, setCycles] = useState<PayoutCycleSummary[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [cycleDetails, setCycleDetails] = useState<CycleDetailsResponse | null>(null);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modals state
  const [markPaidLine, setMarkPaidLine] = useState<PayoutReportLine | null>(null);
  const [paymentReference, setPaymentReference] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const [holdLine, setHoldLine] = useState<PayoutReportLine | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [submittingHold, setSubmittingHold] = useState(false);

  const [viewItemsLine, setViewItemsLine] = useState<PayoutReportLine | null>(null);
  const [generatingCycle, setGeneratingCycle] = useState(false);

  async function loadCycles(autoSelectLatest = true) {
    try {
      setLoadingCycles(true);
      setError(null);
      const res = await api<PayoutCycleSummary[]>("/admin/payout-cycles");
      setCycles(res);
      if (autoSelectLatest && res.length > 0) {
        setSelectedCycleId(res[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load payout cycles.");
    } finally {
      setLoadingCycles(false);
    }
  }

  async function loadCycleDetails(cycleId: string) {
    try {
      setLoadingDetails(true);
      setError(null);
      const res = await api<CycleDetailsResponse>(`/admin/payout-cycles/${cycleId}`);
      setCycleDetails(res);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to load cycle details.");
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    loadCycles(true);
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      loadCycleDetails(selectedCycleId);
    } else {
      setCycleDetails(null);
    }
  }, [selectedCycleId]);

  async function handleGenerateCycle() {
    try {
      setGeneratingCycle(true);
      setError(null);
      setSuccess(null);
      const res = await api<{ cycle_id: string; lines_generated: number; total_net: number; message?: string }>(
        "/admin/payout-cycles/generate",
        { method: "POST", body: {} },
      );
      setSuccess(`Payout cycle generated: ${res.lines_generated} recipient lines (${formatKes(res.total_net)} total).`);
      await loadCycles(false);
      setSelectedCycleId(res.cycle_id);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to generate payout cycle.");
    } finally {
      setGeneratingCycle(false);
    }
  }

  async function handleConfirmMarkPaid() {
    if (!markPaidLine || !paymentReference.trim()) return;
    try {
      setSubmittingPayment(true);
      setError(null);
      await api(`/admin/payout-cycles/lines/${markPaidLine.id}/mark-paid`, {
        method: "POST",
        body: { payment_reference: paymentReference.trim() },
      });
      setSuccess(`Disbursement recorded for ${markPaidLine.payee.full_name}. Confirmation email dispatched.`);
      setMarkPaidLine(null);
      setPaymentReference("");
      if (selectedCycleId) loadCycleDetails(selectedCycleId);
      loadCycles(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to mark payout as paid.");
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleConfirmHold(hold: boolean) {
    if (!holdLine) return;
    try {
      setSubmittingHold(true);
      setError(null);
      await api(`/admin/payout-cycles/lines/${holdLine.id}/hold`, {
        method: "POST",
        body: { hold, hold_reason: hold ? holdReason.trim() : undefined },
      });
      setSuccess(`Payout line status updated.`);
      setHoldLine(null);
      setHoldReason("");
      if (selectedCycleId) loadCycleDetails(selectedCycleId);
      loadCycles(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to update hold status.");
    } finally {
      setSubmittingHold(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">Payout Cycles & Settlements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review bi-weekly settlement batches, execute offline disbursements, and log payment references.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadCycles(false);
              if (selectedCycleId) loadCycleDetails(selectedCycleId);
            }}
            disabled={loadingCycles || loadingDetails}
          >
            <RefreshCw className="size-3.5 mr-1.5" /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerateCycle}
            disabled={generatingCycle}
          >
            <PlusCircle className="size-3.5 mr-1.5" />
            {generatingCycle ? "Generating..." : "Generate Payout Cycle"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-sm">
          <Check className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Cycle Selector & KPIs */}
      {cycles.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {cycles.map((c) => {
              const isSelected = c.id === selectedCycleId;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCycleId(c.id)}
                  className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all text-left shrink-0 ${
                    isSelected
                      ? "bg-amber-500 text-ink-900 border-amber-500 shadow-xs font-semibold"
                      : "bg-card text-muted-foreground hover:text-foreground border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="font-serif">
                    Cycle: {new Date(c.payday).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div className="text-xs opacity-80 mt-0.5">
                    {formatKes(c.total_amount)} · {c.paid_lines}/{c.total_lines} paid
                  </div>
                </button>
              );
            })}
          </div>

          {/* Metrics summary for selected cycle */}
          {cycleDetails && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Total Settlement
                </span>
                <p className="text-2xl font-serif font-bold text-foreground">
                  {formatKes(
                    cycleDetails.lines.reduce((acc, l) => acc + l.net_amount, 0)
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-emerald-600">
                  Paid Lines
                </span>
                <p className="text-2xl font-serif font-bold text-emerald-600">
                  {cycleDetails.lines.filter((l) => l.status === "paid").length}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-blue-600">
                  Pending Lines
                </span>
                <p className="text-2xl font-serif font-bold text-blue-600">
                  {cycleDetails.lines.filter((l) => l.status === "pending").length}
                </p>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-1 shadow-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-amber-600">
                  Held / Disputed
                </span>
                <p className="text-2xl font-serif font-bold text-amber-600">
                  {cycleDetails.lines.filter((l) => l.status === "held").length}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : !loadingCycles ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
            <Wallet className="size-6" />
          </div>
          <h3 className="font-serif font-medium text-lg">No payout cycles exist yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Click &quot;Generate Payout Cycle&quot; to aggregate unallocated sales ledger rows for the current settlement Thursday.
          </p>
        </div>
      ) : null}

      {/* Recipient Lines Table */}
      {loadingDetails ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading settlement lines...</div>
      ) : cycleDetails ? (
        <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
            <h3 className="font-serif font-medium text-base">Recipient Disbursements</h3>
            <span className="text-xs font-mono text-muted-foreground">
              {cycleDetails.lines.length} Recipients
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/60 text-xs text-muted-foreground uppercase font-mono">
                <tr>
                  <th className="px-5 py-3.5">Payee</th>
                  <th className="px-5 py-3.5">Receiving Account Details</th>
                  <th className="px-5 py-3.5">Name Match</th>
                  <th className="px-5 py-3.5">Net Amount (KES)</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Payment Ref</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {cycleDetails.lines.map((line) => (
                  <tr key={line.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-foreground">{line.payee.full_name}</div>
                      <div className="text-xs text-muted-foreground">{line.payee.email} · <span className="capitalize font-mono">{line.payee.role}</span></div>
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {line.method_snapshot ? (
                        <div className="space-y-0.5">
                          <div className="font-medium flex items-center gap-1.5">
                            {line.method_snapshot.type === "mpesa" ? (
                              <Smartphone className="size-3.5 text-emerald-600" />
                            ) : (
                              <Building2 className="size-3.5 text-blue-600" />
                            )}
                            <span>
                              {line.method_snapshot.type === "mpesa" ? "M-Pesa" : line.method_snapshot.bank_name || "Bank"}
                            </span>
                          </div>
                          <div className="font-mono text-foreground font-semibold">
                            {line.decrypted_account || `•••• ${line.method_snapshot.account_last4}`}
                          </div>
                          <div className="text-muted-foreground italic">
                            {line.method_snapshot.account_name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-amber-600 font-medium">No method set</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {line.name_match ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <ShieldCheck className="size-3.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <AlertTriangle className="size-3.5" /> Mismatch
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold font-mono text-foreground">
                      {formatKes(line.net_amount)}
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {line.status === "paid" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                          <CheckCircle2 className="size-3.5" /> Paid
                        </span>
                      ) : line.status === "held" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-medium" title={line.hold_reason || ""}>
                          <AlertTriangle className="size-3.5" /> Held
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-medium">
                          <Clock className="size-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      {line.payment_reference ? (
                        <span className="bg-muted px-2 py-1 rounded text-foreground font-semibold">
                          {line.payment_reference}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewItemsLine(line)}
                        title="View Book Breakdown"
                      >
                        <Eye className="size-3.5" />
                      </Button>

                      {line.status !== "paid" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setHoldLine(line);
                              setHoldReason(line.hold_reason || "");
                            }}
                            title={line.status === "held" ? "Release Hold" : "Place on Hold"}
                          >
                            {line.status === "held" ? (
                              <PlayCircle className="size-3.5 text-blue-600" />
                            ) : (
                              <PauseCircle className="size-3.5 text-amber-600" />
                            )}
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setMarkPaidLine(line);
                              setPaymentReference("");
                            }}
                          >
                            Mark Paid
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Modal: Mark Paid */}
      <Modal
        open={Boolean(markPaidLine)}
        onClose={() => setMarkPaidLine(null)}
        title="Record Payout Disbursement"
        description={`Record the offline M-Pesa or Bank transaction reference for ${markPaidLine?.payee.full_name}.`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setMarkPaidLine(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmMarkPaid}
              disabled={submittingPayment || !paymentReference.trim()}
            >
              {submittingPayment ? "Recording..." : "Confirm & Send Email"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Recipient:</span>
              <span className="font-semibold">{markPaidLine?.payee.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-mono font-bold text-emerald-600">{formatKes(markPaidLine?.net_amount ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destination:</span>
              <span className="font-mono">{markPaidLine?.decrypted_account || `•••• ${markPaidLine?.method_snapshot?.account_last4}`}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Payment Transaction Reference (M-Pesa code / RTGS Ref)
            </label>
            <input
              type="text"
              placeholder="e.g. QHK897321 or BANK-TX-88219"
              value={paymentReference}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPaymentReference(e.target.value)}
              className="w-full h-10 px-3 rounded-md border border-line bg-paper text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Hold / Dispute */}
      <Modal
        open={Boolean(holdLine)}
        onClose={() => setHoldLine(null)}
        title={holdLine?.status === "held" ? "Release Hold" : "Place Payout on Hold"}
        description={
          holdLine?.status === "held"
            ? "Release this payout line to allow disbursement."
            : "Hold this line if account verification or royalty audit is pending."
        }
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setHoldLine(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleConfirmHold(holdLine?.status !== "held")}
              disabled={submittingHold}
            >
              {submittingHold
                ? "Updating..."
                : holdLine?.status === "held"
                ? "Release to Pending"
                : "Apply Hold"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {holdLine?.status !== "held" && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Reason for Hold
              </label>
              <input
                type="text"
                placeholder="e.g. Account name mismatch or suspicious royalty volume"
                value={holdReason}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setHoldReason(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-line bg-paper text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Breakdown of Items */}
      <Modal
        open={Boolean(viewItemsLine)}
        onClose={() => setViewItemsLine(null)}
        title={`Earnings Breakdown · ${viewItemsLine?.payee.full_name}`}
        description="Detailed ledger lines included in this payout batch."
        footer={
          <Button variant="outline" size="sm" onClick={() => setViewItemsLine(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          {viewItemsLine?.items.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-foreground">{item.book_title}</p>
                <p className="text-xs text-muted-foreground">
                  Gross: {formatKes(item.gross)} · Role: <span className="capitalize">{item.payee_role}</span>
                </p>
              </div>
              <div className="font-mono font-semibold text-emerald-600">
                {formatKes(item.amount)}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
