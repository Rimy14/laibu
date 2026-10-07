"use client";

import { useEffect, useState } from "react";
import { BookCheck, Check, X, Ban, CheckCircle2, AlertCircle } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";

interface AdminBookItem {
  id: string;
  author_id: string;
  author_name: string;
  author_email: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  price_kes: string;
  status: "draft" | "pending_author" | "declined_by_author" | "pending_admin" | "rejected" | "live" | "delisted";
  drm_status: "pending" | "processing" | "processed" | "failed";
  file_format: string | null;
  file_size_bytes: string | null;
  review_notes: string | null;
  live_at: string | null;
  created_at: string;
}

export default function ApprovalsPage() {
  const [books, setBooks] = useState<AdminBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>("pending_admin");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reject dialog
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadBooks(statusFilter = activeFilter) {
    try {
      setLoading(true);
      setError(null);
      const query = statusFilter && statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await api<{ books: AdminBookItem[] }>(`/admin/books${query}`);
      setBooks(res.books);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks(activeFilter);
  }, [activeFilter]);

  async function handleApprove(bookId: string) {
    try {
      setActionLoading(true);
      setError(null);
      await api(`/admin/books/${bookId}/approve`, { method: "POST" });
      setSuccess("Book approved! It is now live on the storefront.");
      loadBooks();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit() {
    if (!rejectId || !rejectNotes.trim()) return;

    try {
      setActionLoading(true);
      setError(null);
      await api(`/admin/books/${rejectId}/reject`, {
        method: "POST",
        body: { notes: rejectNotes },
      });
      setSuccess("Book rejected with review notes sent to author.");
      setRejectId(null);
      setRejectNotes("");
      loadBooks();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelist(bookId: string) {
    try {
      setActionLoading(true);
      setError(null);
      await api(`/admin/books/${bookId}/delist`, { method: "POST" });
      setSuccess("Book delisted from storefront.");
      loadBooks();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">Book Review & Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review uploaded manuscripts, verify DRM encryption, and approve for storefront publication.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 text-xs font-medium">
          <button
            onClick={() => setActiveFilter("pending_admin")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeFilter === "pending_admin"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending Review
          </button>
          <button
            onClick={() => setActiveFilter("live")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeFilter === "live"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setActiveFilter("rejected")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeFilter === "rejected"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Rejected
          </button>
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeFilter === "all"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            All Books
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-xs hover:underline opacity-75">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-xs hover:underline opacity-75">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading review queue...</div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-border/60 p-12 text-center bg-card">
          <div className="size-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
            <BookCheck className="size-6" />
          </div>
          <h3 className="text-base font-serif font-medium">Review queue is empty</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            There are currently no books waiting in this status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="rounded-xl border border-border/60 bg-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xs"
            >
              <div className="space-y-2 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      book.status === "live"
                        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : book.status === "pending_admin"
                        ? "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400"
                        : book.status === "rejected"
                        ? "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {book.status === "pending_admin" ? "Pending Review" : book.status}
                  </span>

                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                    {book.file_format || "PDF"}
                  </span>

                  <span className="text-xs text-muted-foreground">
                    DRM: <strong className="text-foreground">{book.drm_status}</strong>
                  </span>
                </div>

                <h3 className="text-xl font-serif font-medium leading-snug">{book.title}</h3>
                {book.subtitle && <p className="text-sm text-muted-foreground">{book.subtitle}</p>}

                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                  <span>Author: <strong className="text-foreground">{book.author_name}</strong> ({book.author_email})</span>
                  <span>Price: <strong className="text-foreground">KES {book.price_kes}</strong></span>
                  <span>Submitted: {new Date(book.created_at).toLocaleString()}</span>
                </div>

                {book.description && (
                  <p className="text-sm text-muted-foreground/90 line-clamp-2 pt-1 leading-relaxed">
                    {book.description}
                  </p>
                )}

                {book.review_notes && (
                  <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/40">
                    <span className="font-medium block">Previous Review Notes:</span>
                    {book.review_notes}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {book.status === "pending_admin" && (
                  <>
                    <Button
                      onClick={() => handleApprove(book.id)}
                      disabled={actionLoading || book.drm_status !== "processed"}
                      className="gap-1.5"
                    >
                      <Check className="size-4" /> Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejectId(book.id)}
                      disabled={actionLoading}
                      className="gap-1.5 text-rose-600 hover:text-rose-700"
                    >
                      <X className="size-4" /> Reject
                    </Button>
                  </>
                )}

                {book.status === "live" && (
                  <Button
                    variant="outline"
                    onClick={() => handleDelist(book.id)}
                    disabled={actionLoading}
                    className="gap-1.5 text-amber-600 hover:text-amber-700"
                  >
                    <Ban className="size-4" /> Delist Book
                  </Button>
                )}

                {book.status === "rejected" && (
                  <Button
                    onClick={() => handleApprove(book.id)}
                    disabled={actionLoading || book.drm_status !== "processed"}
                    variant="outline"
                    className="gap-1.5"
                  >
                    Re-Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        open={!!rejectId}
        onClose={() => setRejectId(null)}
        title="Reject Book Submission"
        description="Provide feedback or required revisions. The author will see these notes on their dashboard."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejectId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectSubmit}
              disabled={actionLoading || !rejectNotes.trim()}
            >
              Confirm Rejection
            </Button>
          </div>
        }
      >
        <div className="space-y-3 pt-2">
          <textarea
            rows={4}
            className="block w-full rounded-md border border-line p-3 text-[0.95rem] outline-none focus:border-ink-700"
            placeholder="e.g. Please re-upload with high resolution cover image and fix formatting on Chapter 2."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
