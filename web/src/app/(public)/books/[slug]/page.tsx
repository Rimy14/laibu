"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ShieldCheck, Smartphone, CheckCircle2, Clock } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatKes } from "@/lib/brand";
import { BookCover } from "@/components/public/book-cover";

interface BookDetail {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  language: string;
  page_count: number | null;
  price_kes: string;
  is_superadmin_book: boolean;
  author_id: string;
  author_name: string;
  author_room_slug: string | null;
  publisher_name: string | null;
  file_format: string | null;
  cover_object_key: string | null;
  live_at: string | null;
}

export default function BookDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const toast = useToast();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    async function fetchBook() {
      try {
        setLoading(true);
        const res = await api<{ book: BookDetail }>(`/books/detail/${slug}`);
        setBook(res.book);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Book not found.");
      } finally {
        setLoading(false);
      }
    }
    if (slug) fetchBook();
  }, [slug]);

  async function handleBuy() {
    setBuying(true);
    // Simulates M-Pesa STK push trigger (Sprint 5)
    await new Promise((r) => setTimeout(r, 700));
    setBuying(false);
    toast.info("M-Pesa STK Push", {
      description: `Checkout for "${book?.title}" will prompt STK push in Sprint 5.`,
    });
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <Clock className="size-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Loading book details...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4">
        <h2 className="text-2xl font-serif font-medium">Book Not Found</h2>
        <p className="text-sm text-muted-foreground">{error || "This book is not currently published."}</p>
        <Button onClick={() => router.push("/")} variant="outline" className="gap-2">
          <ArrowLeft className="size-4" /> Back to Storefront
        </Button>
      </div>
    );
  }

  const priceNum = parseFloat(book.price_kes);

  return (
    <div className="max-w-5xl mx-auto my-8 sm:my-16 px-4 space-y-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Catalogue
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-10 lg:gap-14 items-start">
        {/* Cover view */}
        <div className="mx-auto md:mx-0 w-full max-w-[280px] shadow-lg rounded-xl overflow-hidden">
          <BookCover
            title={book.title}
            author={book.author_name}
            cover={{ bg: "#1c1c21", fg: "#ffffff", accent: "#f6b40e", motif: "sun" }}
          />
        </div>

        {/* Details & Buy Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {book.is_superadmin_book && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-400">
                  Laibu Pick
                </span>
              )}
              {book.category && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                  {book.category}
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono uppercase bg-muted text-muted-foreground">
                {book.file_format || "PDF"}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight text-foreground">
              {book.title}
            </h1>
            {book.subtitle && <p className="text-lg text-muted-foreground">{book.subtitle}</p>}

            <p className="text-sm pt-1">
              By{" "}
              {book.author_room_slug ? (
                <Link
                  href={`/authors/${book.author_room_slug}`}
                  className="font-medium text-amber-600 dark:text-amber-400 hover:underline"
                >
                  {book.author_name}
                </Link>
              ) : (
                <strong className="text-foreground">{book.author_name}</strong>
              )}
              {book.publisher_name && (
                <span className="text-muted-foreground"> · Published by {book.publisher_name}</span>
              )}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-serif font-semibold text-foreground">
                {formatKes(priceNum)}
              </span>
              <span className="text-xs text-muted-foreground">One-time purchase · DRM protected</span>
            </div>

            <Button
              size="lg"
              onClick={handleBuy}
              loading={buying}
              className="w-full text-base font-medium bg-amber-500 hover:bg-amber-400 text-ink-900"
            >
              Buy with M-Pesa
            </Button>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs text-muted-foreground border-t border-border/40">
              <div className="flex items-center gap-2">
                <Smartphone className="size-4 text-primary shrink-0" />
                <span>Read on up to 3 devices</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                <span>AES-256 DRM Protection</span>
              </div>
            </div>
          </div>

          {book.description && (
            <div className="space-y-2 pt-4">
              <h3 className="font-serif font-medium text-lg">About this Book</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-sm sm:text-base">
                {book.description}
              </p>
            </div>
          )}

          {book.page_count && (
            <p className="text-xs text-muted-foreground border-t border-border/40 pt-4">
              Print length: {book.page_count} pages · Language: {book.language.toUpperCase()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
