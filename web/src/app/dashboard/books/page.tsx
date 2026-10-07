"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Upload, CheckCircle2, Clock, AlertCircle, XCircle } from "lucide-react";
import { api, apiForm, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Modal } from "@/components/ui/dialog";

interface Book {
  id: string;
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
  created_at: string;
}

export default function MyBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fiction");
  const [pageCount, setPageCount] = useState("");
  const [priceKes, setPriceKes] = useState("500");
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  async function loadBooks() {
    try {
      setLoading(true);
      const res = await api<{ books: Book[] }>("/books/my");
      setBooks(res.books);
    } catch {
      // Ignore initial failure if not signed in as author
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBooks();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookFile) {
      setError("Please select a book file (PDF, EPUB, DOCX, or HTML).");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append("title", title);
      if (subtitle) formData.append("subtitle", subtitle);
      if (description) formData.append("description", description);
      if (category) formData.append("category", category);
      if (pageCount) formData.append("page_count", pageCount);
      formData.append("price_kes", priceKes);
      formData.append("language", "en");
      formData.append("file", bookFile);
      if (coverFile) formData.append("cover", coverFile);

      await apiForm("/books", formData);

      setSuccess("Book uploaded successfully and submitted for admin review!");
      setModalOpen(false);

      // Reset form
      setTitle("");
      setSubtitle("");
      setDescription("");
      setBookFile(null);
      setCoverFile(null);

      loadBooks();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to upload book. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderStatusBadge(status: Book["status"], drmStatus: Book["drm_status"]) {
    if (drmStatus === "processing") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
          <Clock className="size-3.5 animate-spin" /> DRM Encrypting
        </span>
      );
    }
    if (status === "live") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" /> Live on Storefront
        </span>
      );
    }
    if (status === "pending_admin") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
          <Clock className="size-3.5" /> Under Admin Review
        </span>
      );
    }
    if (status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          <XCircle className="size-3.5" /> Changes Requested
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
        {status}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-medium tracking-tight">My Books</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload, manage DRM-protected manuscripts, and track publication reviews.
          </p>
        </div>

        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus className="size-4" /> Upload New Book
        </Button>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Upload Book Manuscript"
        description="Upload a manuscript for DRM encryption and admin review."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {error && (
            <div className="p-3 text-sm rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Field
            label="Book Title"
            required
            placeholder="e.g. Whispers of the Savannah"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Price (KES)"
              type="number"
              min="0"
              step="50"
              required
              value={priceKes}
              onChange={(e) => setPriceKes(e.target.value)}
            />
            <Field
              label="Category"
              placeholder="e.g. Non-Fiction, Fiction, Tech"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field
              label="Subtitle"
              placeholder="Optional subtitle"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
            <Field
              label="Estimated Page Count"
              type="number"
              min="1"
              placeholder="e.g. 240"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-900">
              Book Description / Synopsis
            </label>
            <textarea
              rows={3}
              className="block w-full rounded-md border border-line p-3 text-[0.95rem] outline-none focus:border-ink-700"
              placeholder="Summary for buyers on the storefront..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <Field
              label="Manuscript File * (PDF/EPUB)"
              type="file"
              accept=".pdf,.epub,.docx,.html"
              required
              onChange={(e) => setBookFile(e.target.files?.[0] || null)}
            />
            <Field
              label="Cover Image (Optional)"
              type="file"
              accept="image/*"
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-line/40">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Encrypting & Uploading..." : "Upload & Submit"}
            </Button>
          </div>
        </form>
      </Modal>

      {success && (
        <div className="p-4 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading your books...</div>
      ) : books.length === 0 ? (
        <div className="rounded-xl border border-border/60 p-12 text-center bg-card">
          <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="size-6" />
          </div>
          <h3 className="text-base font-serif font-medium">No books uploaded yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Upload your first manuscript. It will be scanned for malware, AES-256 DRM encrypted, and submitted for review.
          </p>
          <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2">
            <Upload className="size-4" /> Upload Your First Book
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map((book) => (
            <div
              key={book.id}
              className="rounded-xl border border-border/60 bg-card p-5 flex flex-col justify-between hover:border-border transition-all shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  {renderStatusBadge(book.status, book.drm_status)}
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {book.file_format || "PDF"}
                  </span>
                </div>

                <h3 className="font-serif font-medium text-lg leading-snug">{book.title}</h3>
                {book.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{book.subtitle}</p>
                )}

                {book.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {book.description}
                  </p>
                )}

                {book.status === "rejected" && book.review_notes && (
                  <div className="mt-3 p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900/40">
                    <span className="font-medium block mb-0.5">Admin Review Notes:</span>
                    {book.review_notes}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground text-sm">KES {book.price_kes}</span>
                <span>{new Date(book.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
