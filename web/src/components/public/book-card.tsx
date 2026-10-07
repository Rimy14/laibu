"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { BRAND, formatKes } from "@/lib/brand";
import type { SampleBook } from "@/lib/sample-books";
import { BookCover } from "./book-cover";

export function BookCard({ book }: { book: SampleBook }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  // Preview only: M-Pesa checkout arrives in Sprint 5.
  const buy = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700));
    setBusy(false);
    toast.info("Checkout is coming soon", {
      description: `M-Pesa checkout for "${book.title}" opens in a later release.`,
    });
  };

  return (
    <article className="group flex flex-col">
      <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1">
        <BookCover title={book.title} author={book.author} cover={book.cover} />
      </div>
      <div className="mt-4 flex-1">
        {book.pinned && <p className="mb-1 text-xs text-amber-700">{BRAND.name} pick</p>}
        <h3 className="line-clamp-2 text-[1.1rem] leading-snug text-ink-900">{book.title}</h3>
        <p className="mt-1 text-sm text-ink-500">{book.author}</p>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[0.95rem] font-medium text-ink-900">{formatKes(book.priceKes)}</span>
        <Button size="sm" variant="outline" onClick={buy} loading={busy} aria-label={`Buy ${book.title}`}>
          Buy
        </Button>
      </div>
    </article>
  );
}
