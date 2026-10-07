"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { Logo } from "./logo";

const NAV = [
  { href: "/#bestsellers", label: "Bestsellers" },
  { href: "/#collection", label: "Browse" },
  { href: "/#authors", label: "For authors" },
  { href: "/#how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const session = useSession();
  const signedIn = session.status === "authenticated";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 bg-ink-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-amber-500 focus:px-4 focus:py-2 focus:text-ink-900"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/65 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session.status === "loading" ? (
            <span className="hidden h-9 w-40 sm:block" aria-hidden />
          ) : signedIn ? (
            <ButtonLink href="/dashboard" size="sm" variant="outline-light" className="hidden sm:inline-flex">
              My account
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="hidden px-3 py-2 text-sm text-white/75 hover:text-white sm:block">
                Sign in
              </Link>
              <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
                Create account
              </ButtonLink>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid size-11 place-items-center rounded-md text-white hover:bg-white/5 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div
        id="mobile-menu"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 top-16 z-40 animate-fade-in overflow-y-auto bg-ink-900 px-4 pb-10 pt-2 lg:hidden"
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="border-b border-white/8 py-4 font-serif text-xl text-white">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 grid gap-3">
          {signedIn ? (
            <ButtonLink href="/dashboard" size="lg" onClick={() => setOpen(false)}>
              My account
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signup" size="lg" onClick={() => setOpen(false)}>
                Create account
              </ButtonLink>
              <ButtonLink href="/login" variant="outline-light" size="lg" onClick={() => setOpen(false)}>
                Sign in
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
