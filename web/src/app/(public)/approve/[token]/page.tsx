"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock, BookOpen, AlertCircle, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface ApprovalDetails {
  id: string;
  bookId: string;
  bookTitle: string;
  subtitle: string | null;
  description: string | null;
  publisherName: string;
  publisherEmail: string;
  authorEmail: string;
  priceKes: number;
  authorRoyaltyPct: number;
  feeRate: number;
  exFee: number;
  exRemainder: number;
  exAuthor: number;
  exPublisher: number;
  status: "pending" | "approved" | "declined" | "expired";
  expiresAt: string;
  isSettled: boolean;
  decidedAt: string | null;
}

export default function ApproveProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [approval, setApproval] = useState<ApprovalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadDetails() {
    try {
      setLoading(true);
      setError(null);
      const res = await api<{ approval: ApprovalDetails }>(`/approvals/${token}`);
      setApproval(res.approval);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load proposal details.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadDetails();
  }, [token]);

  async function handleApprove() {
    try {
      setActing(true);
      setError(null);
      const res = await api<{ approval: ApprovalDetails; message: string }>(
        `/approvals/${token}/approve`,
        { method: "POST" },
      );
      setApproval(res.approval);
      setSuccess(res.message);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActing(false);
    }
  }

  async function handleDecline() {
    try {
      setActing(true);
      setError(null);
      const res = await api<{ approval: ApprovalDetails; message: string }>(
        `/approvals/${token}/decline`,
        { method: "POST" },
      );
      setApproval(res.approval);
      setSuccess(res.message);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Clock className="size-8 text-muted-foreground animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading proposal details...</p>
        </div>
      </div>
    );
  }

  if (error && !approval) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-xl border border-border bg-card text-center space-y-4">
        <div className="size-12 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center mx-auto">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-xl font-serif font-medium">Invalid or Expired Link</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!approval) return null;

  return (
    <div className="max-w-2xl mx-auto my-8 sm:my-12 px-4 space-y-6">
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xs space-y-6">
        {/* Header */}
        <div className="border-b border-border/60 pb-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
            <BookOpen className="size-3.5" /> Book Publication Proposal
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight">
            "{approval.bookTitle}"
          </h1>
          {approval.subtitle && (
            <p className="text-sm text-muted-foreground">{approval.subtitle}</p>
          )}
          <p className="text-xs text-muted-foreground pt-1">
            Proposed by <strong>{approval.publisherName}</strong> ({approval.publisherEmail}) for{" "}
            <strong>{approval.authorEmail}</strong>
          </p>
        </div>

        {/* Settled or Expired State Banner */}
        {approval.status === "approved" && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
            <div>
              <h4 className="text-sm font-semibold">Proposal Approved</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                You agreed to publish this book. It has been forwarded to the Superadmin team for final review.
              </p>
            </div>
          </div>
        )}

        {approval.status === "declined" && (
          <div className="p-4 rounded-xl bg-rose-50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40 flex items-center gap-3">
            <XCircle className="size-5 shrink-0 text-rose-600" />
            <div>
              <h4 className="text-sm font-semibold">Proposal Declined</h4>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-0.5">
                You declined this request. The publisher has been notified and nothing will be published.
              </p>
            </div>
          </div>
        )}

        {approval.status === "expired" && (
          <div className="p-4 rounded-xl bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 flex items-center gap-3">
            <Clock className="size-5 shrink-0" />
            <div>
              <h4 className="text-sm font-semibold">Link Expired</h4>
              <p className="text-xs mt-0.5">
                This proposal expired after 14 days without response.
              </p>
            </div>
          </div>
        )}

        {/* Proposal Summary */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/40 text-sm">
          <div>
            <span className="text-xs text-muted-foreground block uppercase font-mono tracking-wider">
              List Price
            </span>
            <span className="text-lg font-serif font-medium">KES {approval.priceKes.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block uppercase font-mono tracking-wider">
              Your Royalty Share
            </span>
            <span className="text-lg font-serif font-medium text-emerald-600 dark:text-emerald-400">
              {approval.authorRoyaltyPct}%
            </span>
          </div>
        </div>

        {/* Canonical Split Table */}
        <div className="space-y-3">
          <h3 className="text-sm font-serif font-medium">Worked Example (Per 1 Sale)</h3>
          <div className="rounded-xl border border-border/60 overflow-hidden text-sm">
            <div className="flex justify-between px-4 py-2.5 bg-muted/30 border-b border-border/40">
              <span className="text-muted-foreground">Book Sale Price</span>
              <span>KES {approval.priceKes.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-border/40 text-muted-foreground">
              <span>Platform Fee ({approval.feeRate}%)</span>
              <span>-KES {approval.exFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 border-b border-border/40">
              <span className="text-muted-foreground">Remaining Net Split Pool</span>
              <span>KES {approval.exRemainder.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-4 py-3 bg-emerald-50/60 dark:bg-emerald-950/20 font-medium text-emerald-900 dark:text-emerald-300">
              <span>You Receive ({approval.authorRoyaltyPct}%)</span>
              <span className="font-semibold text-base">KES {approval.exAuthor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between px-4 py-2.5 text-xs text-muted-foreground">
              <span>Publisher Receives</span>
              <span>KES {approval.exPublisher.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payout note */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
          <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
          <p>
            Royalties are calculated per sale and paid out automatically on the <strong>2nd and 4th Thursday</strong> of each month to your configured M-Pesa or bank account.
          </p>
        </div>

        {/* Action Buttons (Only if pending) */}
        {approval.status === "pending" && (
          <div className="pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleDecline}
              disabled={acting}
              className="w-full sm:w-auto text-rose-600 hover:text-rose-700"
            >
              Decline Proposal
            </Button>
            <Button
              onClick={handleApprove}
              disabled={acting}
              className="w-full sm:w-auto gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="size-4" />
              {acting ? "Confirming..." : "Approve Publication"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
