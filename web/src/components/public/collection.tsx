"use client";

import { Search, SearchX } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { CATEGORIES, type SampleBook } from "@/lib/sample-books";
import { BookCard } from "./book-card";
import { SectionHeading } from "./sections";

export function Collection({ books }: { books: SampleBook[] }) {
  const [category, setCategory] = useState<string>("All");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(
      (b) =>
        (category === "All" || b.category === category) &&
        (!q || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)),
    );
  }, [books, category, query]);

  return (
    <section id="collection" className="scroll-mt-20 py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          label="The library"
          title="Browse all books"
          action={
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search by title or author</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title or author"
                className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-sm outline-none transition focus:border-ink-700 focus:ring-3 focus:ring-ink-900/8"
              />
            </label>
          }
        />

        <div role="group" aria-label="Filter by category" className="mt-8 flex gap-6 overflow-x-auto border-b border-line">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "-mb-px shrink-0 border-b-2 pb-3 text-sm transition-colors",
                category === c ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900",
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <p className="sr-only" aria-live="polite">
          {visible.length} books shown
        </p>

        {visible.length > 0 ? (
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
            {visible.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <EmptyState
              icon={<SearchX className="size-5" />}
              title="No books match your search"
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategory("All");
                  }}
                >
                  Clear search
                </Button>
              }
            >
              Try a different title, author or category.
            </EmptyState>
          </div>
        )}
      </div>
    </section>
  );
}
