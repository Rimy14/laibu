"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, Clock, Lock, Sparkles, User } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BookCover } from "@/components/public/book-cover";
import { formatKes } from "@/lib/brand";

interface StorefrontBookItem {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string | null;
  category: string | null;
  price_kes: string;
  is_superadmin_book: boolean;
  author_name: string;
  publisher_name: string | null;
}

interface AuthorRoomData {
  author: {
    id: string;
    full_name: string;
    bio: string | null;
    room_slug: string | null;
  };
  books: StorefrontBookItem[];
  pinned_books: StorefrontBookItem[];
}

export default function AuthorRoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [data, setData] = useState<AuthorRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRoom() {
      try {
        setLoading(true);
        setError(null);
        const res = await api<{ room: AuthorRoomData }>(`/authors/${slug}/room`);
        setData(res.room);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Author room not found or currently locked.");
      } finally {
        setLoading(false);
      }
    }
    if (slug) loadRoom();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-2">
          <Clock className="size-6 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Opening Author Room...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 text-center space-y-4 rounded-2xl border border-border bg-card">
        <div className="size-12 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center mx-auto">
          <Lock className="size-6" />
        </div>
        <h2 className="text-2xl font-serif font-medium">Author Room Locked</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{error}</p>
        <Button onClick={() => router.push("/")} variant="outline" className="gap-2 mt-2">
          <ArrowLeft className="size-4" /> Return to Storefront
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto my-8 sm:my-16 px-4 space-y-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" /> Back to Storefront
      </Link>

      {/* Author Profile Banner */}
      <div className="rounded-3xl border border-border/80 bg-card p-8 sm:p-10 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="size-20 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl font-serif shrink-0 border border-amber-500/20">
            {data.author.full_name[0]}
          </div>

          <div className="space-y-1.5 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Sparkles className="size-3.5" /> Official Author Room
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-medium tracking-tight text-foreground">
              {data.author.full_name}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {data.author.bio || "Kenyan author on the Laibu marketplace."}
            </p>
          </div>
        </div>
      </div>

      {/* Author's Own Books */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-serif font-medium tracking-tight">
            Books by {data.author.full_name} ({data.books.length})
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Direct from the author. DRM protected and available on all your devices.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {data.books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.slug}`}
              className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-all shadow-xs"
            >
              <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
                <BookCover
                  title={book.title}
                  author={data.author.full_name}
                  cover={{ bg: "#1c1c21", fg: "#ffffff", accent: "#f6b40e", motif: "sun" }}
                />
              </div>
              <div className="mt-4 flex-1">
                <h3 className="line-clamp-2 text-base font-serif font-medium leading-snug group-hover:text-amber-600 transition-colors">
                  {book.title}
                </h3>
                {book.subtitle && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{book.subtitle}</p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                <span className="font-semibold text-foreground">
                  {formatKes(parseFloat(book.price_kes))}
                </span>
                <span className="text-xs text-amber-600 font-medium group-hover:underline">View Book →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Injected Superadmin Pinned Books (§2.4) */}
      {data.pinned_books.length > 0 && (
        <div className="space-y-6 pt-8 border-t border-border/60">
          <div>
            <h2 className="text-xl font-serif font-medium tracking-tight">Featured by Laibu</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hand-picked stories and study resources from editors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.pinned_books.map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.slug}`}
                className="group flex flex-col rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-all shadow-xs"
              >
                <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
                  <BookCover
                    title={book.title}
                    author={book.author_name}
                    cover={{ bg: "#f6b40e", fg: "#1c1c21", accent: "#1c1c21", motif: "grid" }}
                  />
                </div>
                <div className="mt-4 flex-1">
                  <span className="text-[10px] text-amber-700 font-medium uppercase tracking-wider block mb-1">
                    Editor's Choice
                  </span>
                  <h3 className="line-clamp-2 text-base font-serif font-medium leading-snug group-hover:text-amber-600 transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{book.author_name}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-sm">
                  <span className="font-semibold text-foreground">
                    {formatKes(parseFloat(book.price_kes))}
                  </span>
                  <span className="text-xs text-amber-600 font-medium group-hover:underline">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
