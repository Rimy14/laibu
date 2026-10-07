import type { ReactNode } from "react";
import { Logo } from "@/components/public/logo";
import { BookCover } from "@/components/public/book-cover";
import { SAMPLE_BOOKS } from "@/lib/sample-books";

/**
 * Split layout for sign-in / sign-up: a calm form column, and on larger
 * screens a quiet ink panel with a short line about the product.
 */
export function AuthLayout({
  children,
  aside,
  logoSuffix,
  logoHref = "/",
}: {
  children: ReactNode;
  aside?: { title: ReactNode; text: string };
  logoSuffix?: string;
  logoHref?: string;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo tone="dark" href={logoHref} suffix={logoSuffix} />
        <main id="main" className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      {aside && (
        <aside className="relative hidden overflow-hidden bg-ink-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
          <div className="max-w-sm">
            <p className="font-serif text-[2.1rem] leading-tight">{aside.title}</p>
            <p className="mt-4 leading-relaxed text-white/55">{aside.text}</p>
          </div>
          <div aria-hidden className="flex items-end gap-4">
            {[SAMPLE_BOOKS[2], SAMPLE_BOOKS[0], SAMPLE_BOOKS[6]].map((b, i) => (
              <div key={b.id} className={i === 1 ? "w-36" : "w-28"}>
                <BookCover title={b.title} author={b.author} cover={b.cover} size="sm" />
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}

/** Keeps redirects on this site: only plain relative paths are allowed. */
export function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
