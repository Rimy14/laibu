"use client";

import { ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CaptureEvent =
  | "screenshot_key"
  | "window_blur"
  | "tab_hidden"
  | "devtools_open"
  | "print_attempt"
  | "copy_attempt"
  | "context_menu";

type ShieldReason = CaptureEvent | "os_key";

interface SecureViewProps {
  children: ReactNode;
  /** Buyer email / id, tiled across the content so any leaked capture is traceable. */
  watermark?: string;
  /** Called once per attempt (deduplicated), e.g. to POST to /api/security-events. */
  onCaptureAttempt?: (event: CaptureEvent) => void;
  className?: string;
}

const REPORT_COOLDOWN_MS = 10_000;

/**
 * Wraps sensitive content (the book reader, payout account details) and
 * blacks it out when a capture is likely:
 *  - PrintScreen, Win/Cmd key (start of Win+Shift+S, Cmd+Shift+4), Ctrl/Cmd+P
 *  - the window losing focus (snipping tools, screen recorders, app switch)
 *  - the tab being hidden; printing (CSS hides it from print too)
 * Copy, save and right-click are blocked inside it.
 *
 * Limits (be honest with the client): a website cannot stop the phone's own
 * screenshot buttons or every desktop tool; some capture before the page can
 * react. The visible watermark is what makes a leaked image traceable.
 * Real blocking needs a native app (Android FLAG_SECURE).
 */
export function SecureView({ children, watermark, onCaptureAttempt, className }: SecureViewProps) {
  const [shield, setShield] = useState<ShieldReason | null>(null);
  const lastReported = useRef(new Map<CaptureEvent, number>());
  const reportRef = useRef(onCaptureAttempt);
  useEffect(() => {
    reportRef.current = onCaptureAttempt;
  }, [onCaptureAttempt]);

  const report = useCallback((event: CaptureEvent) => {
    const now = Date.now();
    const last = lastReported.current.get(event) ?? 0;
    if (now - last < REPORT_COOLDOWN_MS) return;
    lastReported.current.set(event, now);
    reportRef.current?.(event);
  }, []);

  const raise = useCallback(
    (reason: ShieldReason) => {
      setShield((current) => (current && current !== "os_key" ? current : reason));
      if (reason !== "os_key") report(reason);
    },
    [report],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "PrintScreen") {
        raise("screenshot_key");
        void navigator.clipboard?.writeText("").catch(() => undefined);
        return;
      }
      // Pre-emptive: Win/Cmd is the first key of the OS screenshot shortcuts.
      if (e.key === "Meta" || e.key === "OS") {
        raise("os_key");
        return;
      }
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "s", "S"].includes(e.key)) {
        e.preventDefault();
        raise("screenshot_key");
        return;
      }
      if (mod && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        raise("print_attempt");
        return;
      }
      if (mod && ["s", "S", "c", "C", "x", "X", "a", "A"].includes(e.key)) {
        e.preventDefault();
        report("copy_attempt");
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Windows usually delivers PrintScreen only on key-up
      if (e.key === "PrintScreen") {
        raise("screenshot_key");
        void navigator.clipboard?.writeText("").catch(() => undefined);
      }
      if (e.key === "Meta" || e.key === "OS") {
        setShield((current) => (current === "os_key" ? null : current));
      }
    };
    const onBlur = () => raise("window_blur");
    const onFocus = () =>
      setShield((current) => (current === "window_blur" || current === "tab_hidden" || current === "os_key" ? null : current));
    const onVisibility = () => {
      if (document.visibilityState === "hidden") raise("tab_hidden");
      else onFocus();
    };
    const onBeforePrint = () => raise("print_attempt");

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", onBeforePrint);
    document.addEventListener("visibilitychange", onVisibility);

    // Docked developer tools: report only. Browser zoom produces the same size
    // gap, so blacking out here would punish honest readers.
    let devtoolsSeen = false;
    const devtoolsTimer = window.setInterval(() => {
      const open = window.outerWidth - window.innerWidth > 240 || window.outerHeight - window.innerHeight > 240;
      if (open && !devtoolsSeen && matchMedia("(pointer: fine)").matches) report("devtools_open");
      devtoolsSeen = open;
    }, 2000);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", onBeforePrint);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(devtoolsTimer);
    };
  }, [raise, report]);

  const watermarkStyle = useMemo(() => (watermark ? { backgroundImage: watermarkSvg(watermark) } : undefined), [watermark]);
  const needsAcknowledge = shield === "screenshot_key" || shield === "print_attempt";

  return (
    <div
      className={cn("secure-view relative isolate", className)}
      data-shielded={shield ? "true" : "false"}
      onCopy={(e) => {
        e.preventDefault();
        report("copy_attempt");
      }}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        e.preventDefault();
        report("context_menu");
      }}
    >
      <div className="secure-view__content relative">
        {children}
        {watermarkStyle && (
          <div aria-hidden className="pointer-events-none absolute inset-0 z-10 bg-repeat opacity-[0.09]" style={watermarkStyle} />
        )}
      </div>

      {shield && (
        <div className="absolute inset-0 z-20 flex min-h-64 flex-col items-center justify-center gap-4 bg-black p-6 text-center text-white">
          <ShieldAlert className="size-10 text-amber-500" aria-hidden />
          <div>
            <p className="text-lg font-medium">Protected content</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-white/70">
              {needsAcknowledge
                ? "Screenshots, recording and printing aren't allowed. This attempt was recorded."
                : "Content is hidden while this window isn't active."}
            </p>
          </div>
          {needsAcknowledge && (
            <button
              type="button"
              onClick={() => setShield(null)}
              className="mt-1 h-11 rounded-md bg-amber-500 px-6 text-sm font-semibold text-ink-900 hover:bg-amber-400"
            >
              Continue reading
            </button>
          )}
        </div>
      )}

      <p className="secure-view-print-notice">This content is protected and cannot be printed.</p>
    </div>
  );
}

function watermarkSvg(text: string) {
  const safe = text.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`).slice(0, 80);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
    `<text x="0" y="110" transform="rotate(-24 160 90)" font-family="sans-serif" font-size="15" fill="#000">${safe}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
