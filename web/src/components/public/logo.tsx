import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7", className)} aria-hidden>
      <rect width="28" height="28" rx="5" fill="#e8ae2a" />
      <path d="M7 9.2c2.4-.8 4.7-.6 7 .9v9.4c-2.3-1.5-4.6-1.7-7-.9z" fill="none" stroke="#1d1d20" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M21 9.2c-2.4-.8-4.7-.6-7 .9v9.4c2.3-1.5 4.6-1.7 7-.9z" fill="none" stroke="#1d1d20" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ tone = "light", href = "/", suffix }: { tone?: "light" | "dark"; href?: string; suffix?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-md" aria-label={`${BRAND.name} home`}>
      <LogoMark />
      <span className={cn("font-serif text-[1.45rem] leading-none", tone === "light" ? "text-white" : "text-ink-900")}>{BRAND.name}</span>
      {suffix && (
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[0.7rem] font-medium",
            tone === "light" ? "border-white/20 text-white/70" : "border-line text-ink-500",
          )}
        >
          {suffix}
        </span>
      )}
    </Link>
  );
}
