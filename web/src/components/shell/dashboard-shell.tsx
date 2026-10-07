"use client";

import { LogOut, ShieldX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/public/logo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { ROLE_LABEL, useSession, type Role } from "@/lib/session";

export interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  /** Shown in the phone bottom bar (max 5). */
  primary?: boolean;
}

/**
 * Signed-in layout for authors, publishers, readers and the admin panel.
 * Desktop: quiet sidebar. Phone: top bar + bottom tab bar (thumb-reachable).
 * It also guards the area: no session → sign-in page; wrong role → a clear
 * "no access" screen. (The API enforces the same rules on every request.)
 */
export function DashboardShell({
  nav,
  area,
  roles,
  children,
}: {
  nav: NavItem[];
  area: "account" | "admin";
  roles: Role[];
  children: ReactNode;
}) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const home = area === "admin" ? "/" : "/dashboard";

  useEffect(() => {
    if (session.status === "anonymous" && !signingOut) {
      // "/login" is the public sign-in on the main host and the admin sign-in on the admin host
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [session.status, signingOut, router, pathname]);

  const isActive = (href: string) => (href === home ? pathname === href : pathname.startsWith(href));

  const signOut = async () => {
    setSigningOut(true);
    await session.signOut();
    toast.success("You've signed out");
    router.replace(area === "admin" ? "/login" : "/");
  };

  if (session.status !== "authenticated" || !session.user) return <ShellSkeleton />;

  const user = session.user;
  if (!roles.includes(user.role)) {
    return (
      <main className="grid min-h-dvh place-items-center bg-cream px-4">
        <div className="w-full max-w-md">
          <EmptyState
            icon={<ShieldX className="size-5" />}
            title="This area isn't available to your account"
            action={<ButtonLink href={home} variant="dark">Go back</ButtonLink>}
          >
            You&apos;re signed in as a {ROLE_LABEL[user.role].toLowerCase()}. If you think this is a mistake, contact support.
          </EmptyState>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh bg-paper">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-paper lg:flex">
        <div className="flex h-16 items-center px-6">
          <Logo href={home} tone="dark" suffix={area === "admin" ? "Admin" : undefined} />
        </div>
        <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    isActive(item.href)
                      ? "bg-cream font-medium text-ink-900 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded before:bg-amber-500"
                      : "text-ink-500 hover:bg-cream/60 hover:text-ink-900",
                  )}
                >
                  <span className="[&>svg]:size-[1.1rem]">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <Avatar name={user.full_name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.full_name}</p>
              <p className="text-xs text-ink-500">{ROLE_LABEL[user.role]}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-md text-ink-400 hover:bg-cream hover:text-ink-900"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
          <Logo href={home} tone="dark" suffix={area === "admin" ? "Admin" : undefined} />
          <button type="button" onClick={signOut} className="ml-auto text-sm text-ink-500 hover:text-ink-900">
            Sign out
          </button>
        </header>

        <main id="main" className="flex-1 px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-14 lg:pt-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>

        <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] lg:hidden">
          <ul className="flex">
            {nav
              .filter((n) => n.primary)
              .slice(0, 5)
              .map((item) => (
                <li key={item.href} className="flex-1">
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem]",
                      isActive(item.href) ? "font-medium text-ink-900" : "text-ink-400",
                    )}
                  >
                    <span className={cn("[&>svg]:size-5", isActive(item.href) && "text-amber-700")}>{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-medium text-amber-700" aria-hidden>
      {initials}
    </span>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-paper" role="status" aria-label="Loading your account">
      <div className="hidden w-64 shrink-0 border-r border-line p-6 lg:block">
        <Skeleton className="h-7 w-28" />
        <div className="mt-10 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
      <div className="flex-1 px-4 pt-10 sm:px-10">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="mt-3 h-4 w-80 max-w-full" />
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Page title row used at the top of every dashboard page. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[2rem] sm:text-[2.3rem]">{title}</h1>
        {description && <p className="mt-2 text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mt-2 font-serif text-[1.9rem] leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/** White panel with a title row, used for settings sections and lists. */
export function Panel({ title, description, children, actions }: { title: string; description?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-white">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-[1.35rem]">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}
