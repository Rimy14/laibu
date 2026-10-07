"use client";

import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

type ToastInput = Omit<ToastItem, "id" | "tone">;

interface ToastApi {
  success: (title: string, opts?: Omit<ToastInput, "title">) => void;
  error: (title: string, opts?: Omit<ToastInput, "title">) => void;
  info: (title: string, opts?: Omit<ToastInput, "title">) => void;
  warning: (title: string, opts?: Omit<ToastInput, "title">) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 4;
const DURATION: Record<Tone, number> = { success: 4500, info: 5000, warning: 7000, error: 8000 };

const toneStyle: Record<Tone, { icon: ReactNode; bar: string }> = {
  success: { icon: <CircleCheck className="size-5 text-success-600" />, bar: "bg-success-600" },
  error: { icon: <CircleAlert className="size-5 text-danger-600" />, bar: "bg-danger-600" },
  info: { icon: <Info className="size-5 text-info-600" />, bar: "bg-info-600" },
  warning: { icon: <TriangleAlert className="size-5 text-warning-700" />, bar: "bg-amber-500" },
};

/**
 * Short, non-blocking messages ("Saved", "Payment received").
 * Use a dialog instead when the user must decide something.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((tone: Tone, title: string, opts?: Omit<ToastInput, "title">) => {
    const id = nextId.current++;
    setItems((list) => [...list, { id, tone, title, ...opts }].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, o) => push("success", t, o),
      error: (t, o) => push("error", t, o),
      info: (t, o) => push("info", t, o),
      warning: (t, o) => push("warning", t, o),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end sm:p-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((t) => (
          <ToastCard key={t.id} item={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION[item.tone]);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(onClose, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onClose]);

  const style = toneStyle[item.tone];
  return (
    <div
      role={item.tone === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto relative flex w-full max-w-sm animate-toast-in items-start gap-3 overflow-hidden rounded-lg border border-line bg-white py-3.5 pl-4 pr-3 shadow-[var(--shadow-lift)]"
    >
      <span className={cn("absolute inset-y-0 left-0 w-0.5", style.bar)} aria-hidden />
      <span className="mt-0.5 shrink-0">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{item.title}</p>
        {item.description && <p className="mt-0.5 text-sm leading-snug text-ink-500">{item.description}</p>}
        {item.action && (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick();
              onClose();
            }}
            className="mt-2 text-sm font-medium text-ink-900 underline underline-offset-4 hover:text-amber-700"
          >
            {item.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="grid size-8 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-cream hover:text-ink-900"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
