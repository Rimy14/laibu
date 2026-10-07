import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { SampleBook } from "@/lib/sample-books";
import { BookCard } from "./book-card";
import { BookCover } from "./book-cover";

/** Quiet section heading: a short sentence-case label, then a serif title. */
export function SectionHeading({
  label,
  title,
  children,
  action,
  tone = "dark",
}: {
  label?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "dark" | "light";
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {label && <p className={cn("text-sm", tone === "dark" ? "text-amber-700" : "text-amber-400")}>{label}</p>}
        <h2 className={cn("mt-2 text-[2rem] sm:text-[2.4rem]", tone === "dark" ? "text-ink-900" : "text-white")}>{title}</h2>
        {children && (
          <p className={cn("mt-3 max-w-xl leading-relaxed", tone === "dark" ? "text-ink-500" : "text-white/60")}>{children}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ Hero */
export function Hero({ featured }: { featured: SampleBook[] }) {
  return (
    <section className="bg-ink-900 text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-16 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <p className="text-sm text-amber-400">Ebooks from Kenyan writers</p>
          <h1 className="mt-4 text-[2.6rem] leading-[1.08] sm:text-[3.4rem] lg:text-[3.8rem]">
            Books worth keeping, <em className="text-amber-400">bought in seconds.</em>
          </h1>
          <p className="mt-6 max-w-md text-[1.05rem] leading-relaxed text-white/65">
            Discover stories, study guides and business books from local authors. Pay with M-Pesa and read on up to
            three of your own devices.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/#collection" size="lg">
              Browse books
            </ButtonLink>
            <ButtonLink href="/#authors" size="lg" variant="outline-light">
              Publish your book
            </ButtonLink>
          </div>
          <p className="mt-10 text-sm text-white/45">M-Pesa checkout · Protected copies · Authors paid twice a month</p>
        </div>

        {/* a small shelf of featured covers */}
        <div aria-hidden className="relative mx-auto w-full max-w-md">
          <div className="flex items-end justify-center gap-4 px-4">
            {featured.slice(0, 3).map((b, i) => (
              <div key={b.id} className={cn("shrink-0", i === 1 ? "w-[42%]" : "w-[30%]")}>
                <BookCover title={b.title} author={b.author} cover={b.cover} size={i === 1 ? "md" : "sm"} />
              </div>
            ))}
          </div>
          <div className="mt-0 h-px bg-white/15" />
          <div className="mx-6 h-3 rounded-b-sm bg-white/[0.04]" />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ Book grid */
export function BookGridSection({
  id,
  label,
  title,
  intro,
  books,
  className,
}: {
  id: string;
  label: string;
  title: string;
  intro?: string;
  books: SampleBook[];
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-20 sm:py-24", className)}>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          label={label}
          title={title}
          action={
            <Link href="/#collection" className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900">
              See all books <ArrowRight className="size-4" />
            </Link>
          }
        >
          {intro}
        </SectionHeading>
        <div className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4">
          {books.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------- Authors (amber band) */
const TERMS_AT_A_GLANCE = [
  { term: "Service fee", detail: "12.5% on direct sales. Lower for publishers as they sell more titles." },
  { term: "Payouts", detail: "The 2nd and 4th Thursday of every month, by M-Pesa or bank." },
  { term: "Review", detail: "Every book is checked by our team before it goes live." },
  { term: "Protection", detail: "Each copy is encrypted and watermarked to its buyer." },
];

export function AuthorsBand() {
  return (
    <section id="authors" className="scroll-mt-20 bg-amber-500">
      <div className="mx-auto grid max-w-6xl gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div>
          <p className="text-sm text-ink-900/70">For authors and publishers</p>
          <h2 className="mt-2 text-[2rem] text-ink-900 sm:text-[2.4rem]">Publish once. Get paid twice a month.</h2>
          <p className="mt-5 max-w-md leading-relaxed text-ink-900/75">
            Upload your manuscript, set your price and track every sale. If a publisher sells your book, nothing goes
            live until you approve their royalty offer.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/signup?role=author" variant="dark" size="lg">
              Start as an author
            </ButtonLink>
            <ButtonLink href="/signup?role=publisher" variant="outline" size="lg" className="border-ink-900/20 bg-transparent hover:bg-ink-900/5">
              I&apos;m a publisher
            </ButtonLink>
          </div>
        </div>
        <dl className="divide-y divide-ink-900/15 border-y border-ink-900/15">
          {TERMS_AT_A_GLANCE.map((t) => (
            <div key={t.term} className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
              <dt className="font-medium text-ink-900">{t.term}</dt>
              <dd className="text-ink-900/75">{t.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* --------------------------------------------------------- How it works */
const STEPS = [
  { title: "Find your book", text: "Browse by category or author. Every book is reviewed before it goes live." },
  { title: "Pay with M-Pesa", text: "Confirm the prompt on your phone. No card needed, no account details shared." },
  { title: "Read on your devices", text: "Your copy opens on up to three of your own phones, tablets or computers." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-cream py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading label="Simple from start to finish" title={`How ${BRAND.name} works`} />
        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-ink-900/15 pt-6">
              <span className="font-serif text-lg text-amber-700">0{i + 1}</span>
              <h3 className="mt-3 text-[1.45rem]">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
