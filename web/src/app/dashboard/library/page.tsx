"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, ShieldCheck, Smartphone, Clock, AlertCircle, ArrowRight } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/session";
import { ButtonLink } from "@/components/ui/button";
import { BookCover } from "@/components/public/book-cover";

interface LibraryBook {
  licence_id: string;
  book_id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  author_name: string;
  publisher_name: string | null;
  file_format: string | null;
  cover_object_key: string | null;
  max_devices: number;
  issued_at: string;
}

export default function LibraryPage() {
  const { user } = useSession();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLibrary() {
      try {
        setLoading(true);
        setError(null);
        const res = await api<{ library: LibraryBook[] }>("/me/library");
        setBooks(res.library);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load library.");
      } finally {
        setLoading(false);
      }
    }
    if (user) loadLibrary();
  }, [user]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-medium tracking-tight">My Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your DRM-licenced books. Protected with per-user watermarking and synced across up to 3 authorized devices.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading your library...</div>
      ) : books.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-12 text-center space-y-4">
          <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <BookOpen className="size-7" />
          </div>
          <h3 className="font-serif font-medium text-lg">Your library is empty</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Explore books by Kenyan authors on the storefront and pay instantly via M-Pesa.
          </p>
          <ButtonLink href="/#collection" className="gap-2 mt-2">
            Browse Storefront <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((item) => (
            <div
              key={item.licence_id}
              className="rounded-2xl border border-border/70 bg-card p-4 flex flex-col justify-between hover:border-border transition-all shadow-xs"
            >
              <div>
                <div className="rounded-xl overflow-hidden mb-3">
                  <BookCover
                    title={item.title}
                    author={item.author_name}
                    cover={{ bg: "#1c1c21", fg: "#ffffff", accent: "#f6b40e", motif: "sun" }}
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground inline-block">
                    {item.file_format || "PDF"}
                  </span>
                  <h3 className="font-serif font-medium text-base leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">{item.author_name}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 space-y-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                    <ShieldCheck className="size-3.5" /> DRM Active
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Smartphone className="size-3" /> Max {item.max_devices} Devices
                  </span>
                </div>

                <ButtonLink href={`/books/${item.slug}`} variant="outline" className="w-full text-xs">
                  Read Book
                </ButtonLink>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
