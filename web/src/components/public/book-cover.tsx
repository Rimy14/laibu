import { cn } from "@/lib/cn";
import type { CoverMotif } from "@/lib/sample-books";

interface BookCoverProps {
  title: string;
  author: string;
  cover: { bg: string; fg: string; accent: string; motif: CoverMotif };
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Generated cover used until real cover uploads exist (Sprint 2), and as the
 * fallback when a book has no cover image.
 */
export function BookCover({ title, author, cover, className, size = "md" }: BookCoverProps) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] w-full overflow-hidden rounded-r-[4px] rounded-l-[2px]",
        "shadow-[inset_5px_0_6px_-4px_rgb(0_0_0/0.3),0_1px_2px_rgb(0_0_0/0.08),0_10px_24px_-14px_rgb(0_0_0/0.35)]",
        className,
      )}
      style={{ backgroundColor: cover.bg, color: cover.fg }}
      role="img"
      aria-label={`Cover of ${title} by ${author}`}
    >
      <Motif motif={cover.motif} accent={cover.accent} fg={cover.fg} />
      <div className={cn("relative flex h-full flex-col justify-between", size === "lg" ? "p-7" : size === "sm" ? "p-3" : "p-4")}>
        <span className={cn("opacity-75", size === "lg" ? "text-sm" : "text-[0.62rem]")}>
          {author}
        </span>
        <span
          className={cn(
            "font-serif leading-[1.1] text-balance",
            size === "lg" ? "text-[1.9rem]" : size === "sm" ? "text-sm" : "text-[1.15rem]",
          )}
        >
          {title}
        </span>
      </div>
      {/* spine highlight */}
      <span aria-hidden className="absolute inset-y-0 left-[5px] w-px bg-white/25" />
    </div>
  );
}

function Motif({ motif, accent, fg }: { motif: CoverMotif; accent: string; fg: string }) {
  const common = "absolute inset-0 h-full w-full";
  switch (motif) {
    case "sun":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          <circle cx="140" cy="120" r="46" fill={accent} />
          <path d="M0 230 Q60 190 110 215 T200 200 V300 H0Z" fill={fg} opacity="0.08" />
        </svg>
      );
    case "waves":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M-10 ${150 + i * 18} Q40 ${135 + i * 18} 100 ${150 + i * 18} T210 ${150 + i * 18}`} stroke={accent} strokeWidth="3" fill="none" opacity={0.9 - i * 0.15} />
          ))}
        </svg>
      );
    case "arch":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          <path d="M55 230 V130 A45 45 0 0 1 145 130 V230Z" fill={accent} opacity="0.9" />
          <path d="M75 230 V140 A25 25 0 0 1 125 140 V230Z" fill={fg} opacity="0.15" />
        </svg>
      );
    case "rings":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          {[70, 52, 34].map((r) => (
            <circle key={r} cx="150" cy="150" r={r} fill="none" stroke={accent} strokeWidth="5" opacity={r / 80} />
          ))}
        </svg>
      );
    case "stripes":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={120 + i * 14} y="0" width="6" height="300" fill={accent} opacity={0.85 - i * 0.12} />
          ))}
        </svg>
      );
    case "grid":
      return (
        <svg className={common} viewBox="0 0 200 300" aria-hidden>
          {Array.from({ length: 16 }, (_, i) => (
            <rect key={i} x={110 + (i % 4) * 20} y={100 + Math.floor(i / 4) * 20} width="12" height="12" rx="2" fill={accent} opacity={0.35 + ((i * 7) % 5) * 0.13} />
          ))}
        </svg>
      );
  }
}
