"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, StatCard } from "@/components/shell/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

interface PayoutState {
  method: { type: string; name_matches: boolean } | null;
}

function nextPayday(from = new Date()): Date {
  // 2nd and 4th Thursday, Nairobi time (display only; the server owns the real schedule)
  const eat = new Date(from.getTime() + 3 * 3600_000);
  for (let m = 0; m < 3; m++) {
    const y = eat.getUTCFullYear();
    const mo = eat.getUTCMonth() + m;
    const firstDow = new Date(Date.UTC(y, mo, 1)).getUTCDay();
    const firstThu = 1 + ((4 - firstDow + 7) % 7);
    for (const n of [2, 4]) {
      const d = new Date(Date.UTC(y, mo, firstThu + (n - 1) * 7));
      if (d.getTime() >= Date.UTC(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate())) return d;
    }
  }
  return eat;
}

export default function DashboardHome() {
  const { user, termsCurrent } = useSession();
  const isCreator = user?.role === "author" || user?.role === "publisher";
  const [payout, setPayout] = useState<PayoutState | null>(null);

  // Re-runs once new terms are accepted (requests are refused until then).
  useEffect(() => {
    if (!isCreator || !termsCurrent) return;
    api<PayoutState>("/me/payout-method")
      .then(setPayout)
      .catch(() => setPayout({ method: null }));
  }, [isCreator, termsCurrent]);

  if (!user) return null;
  const firstName = user.full_name.split(" ")[0];
  const payday = nextPayday().toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  if (!isCreator) {
    return (
      <>
        <PageHeader title={`Welcome, ${firstName}`} description="Your books and account in one place." />
        <div className="rounded-[var(--radius-card)] border border-line bg-white p-6 sm:p-8">
          <h2 className="text-[1.5rem]">Find your next read</h2>
          <p className="mt-2 max-w-lg text-ink-500">
            Books you buy appear in your library and open on up to three of your devices.
          </p>
          <ButtonLink href="/#collection" variant="dark" className="mt-6">
            Browse books
          </ButtonLink>
        </div>
      </>
    );
  }

  const steps = [
    {
      done: Boolean(payout?.method),
      title: "Add where we should pay you",
      text: user.role === "publisher" ? "Publishers are paid by bank transfer." : "M-Pesa or a bank account in your name.",
      href: "/dashboard/settings#payout",
      cta: "Add payout method",
    },
    {
      done: false,
      title: user.role === "publisher" ? "Set up your first book" : "Upload your first book",
      text: "PDF, EPUB, DOCX or HTML. Our team reviews every book before it goes live.",
      href: "/dashboard/books",
      cta: "Go to My books",
    },
  ];

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="Here's how your books are doing." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Live books" value="0" hint={user.role === "author" ? "Your author page opens at 2 live books" : undefined} />
        <StatCard label="Earned this cycle" value="KES 0" />
        <StatCard label="Next payday" value={payday} hint="2nd and 4th Thursday of each month" />
      </div>

      <section className="mt-10">
        <h2 className="text-[1.5rem]">Get set up</h2>
        <ol className="mt-4 divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
          {steps.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full border text-sm",
                  s.done ? "border-success-600 bg-success-600 text-white" : "border-line text-ink-500",
                )}
                aria-hidden
              >
                {payout === null && i === 0 ? null : s.done ? <Check className="size-4" /> : i + 1}
              </span>
              <div className="flex-1">
                {payout === null && i === 0 ? (
                  <Skeleton className="h-5 w-56" />
                ) : (
                  <p className={cn("font-medium", s.done && "text-ink-500 line-through decoration-ink-300")}>{s.title}</p>
                )}
                <p className="mt-0.5 text-sm text-ink-500">{s.text}</p>
              </div>
              {!s.done && (
                <Link href={s.href} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-900 hover:text-amber-700">
                  {s.cta} <ArrowRight className="size-4" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
