import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const alertTone: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: "bg-info-50 border-info-600/20", icon: <Info className="size-5 text-info-600" /> },
  success: { box: "bg-success-50 border-success-600/20", icon: <CircleCheck className="size-5 text-success-600" /> },
  warning: { box: "bg-warning-50 border-amber-500/40", icon: <TriangleAlert className="size-5 text-warning-700" /> },
  danger: { box: "bg-danger-50 border-danger-600/20", icon: <CircleAlert className="size-5 text-danger-600" /> },
};

/** Inline, persistent message inside a page or form (unlike a toast, it doesn't disappear). */
export function Alert({ tone = "info", title, children, className }: { tone?: Tone; title: string; children?: ReactNode; className?: string }) {
  const t = alertTone[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border p-4", t.box, className)}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div className="text-sm">
        <p className="font-medium text-ink-900">{title}</p>
        {children && <div className="mt-1 leading-relaxed text-ink-700">{children}</div>}
      </div>
    </div>
  );
}

const badgeTone = {
  neutral: "bg-ink-900/6 text-ink-700",
  amber: "bg-amber-100 text-amber-700",
  success: "bg-success-50 text-success-600",
  danger: "bg-danger-50 text-danger-600",
  info: "bg-info-50 text-info-600",
  dark: "bg-ink-900 text-white",
} as const;

export function Badge({ tone = "neutral", children, className }: { tone?: keyof typeof badgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium", badgeTone[tone], className)}>
      {children}
    </span>
  );
}

/** Friendly "nothing here yet" state that tells the user what to do next. */
export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-cream/50 px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-lg bg-amber-50 text-amber-700">{icon}</div>}
      <h3 className="text-xl text-ink-900">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
