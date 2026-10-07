"use client";

import { TriangleAlert, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/**
 * Modal built on the native <dialog>: the browser handles the focus trap,
 * Escape to close and the top layer, so it stays accessible without extra code.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** false while an action is running, so the dialog can't be closed mid-request. */
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // The browser focuses the first focusable element (the close button);
      // move focus to the field the user actually needs, when one is marked.
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        // click on the backdrop (the dialog element itself, outside the panel)
        if (e.target === ref.current && dismissible) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl bg-paper p-0 text-ink-900 shadow-[var(--shadow-lift)] open:animate-pop-in",
        "backdrop:bg-ink-950/45",
        { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size],
      )}
    >
      {open && (
        <div className="flex flex-col">
          <div className="flex items-start gap-4 px-6 pt-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-2xl">
                {title}
              </h2>
              {description && <div className="mt-1.5 text-sm leading-relaxed text-ink-500">{description}</div>}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 grid size-9 place-items-center rounded-md text-ink-400 hover:bg-cream hover:text-ink-900"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          {children && <div className="px-6 pt-5">{children}</div>}
          {footer && <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">{footer}</div>}
          {!footer && <div className="pb-6" />}
        </div>
      )}
    </dialog>
  );
}

/* --------------------------------------------------------------------------
   Confirm dialog: `const ok = await confirm({...})`
   For destructive or money actions, set `confirmPhrase` so the user has to
   type it (e.g. "MARK PAID") before the button unlocks.
   -------------------------------------------------------------------------- */
interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
  confirmPhrase?: string;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState("");

  const confirm = useCallback<ConfirmFn>(
    (opts) =>
      new Promise<boolean>((resolve) => {
        setTyped("");
        setState({ ...opts, resolve });
      }),
    [],
  );

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  const locked = Boolean(state?.confirmPhrase) && typed.trim() !== state?.confirmPhrase;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={state !== null}
        onClose={() => close(false)}
        size="sm"
        title={state?.title ?? ""}
        description={
          state?.tone === "danger" ? (
            <span className="flex gap-2">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-600" />
              <span>{state?.description}</span>
            </span>
          ) : (
            state?.description
          )
        }
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>
              {state?.cancelText ?? "Cancel"}
            </Button>
            <Button
              variant={state?.tone === "danger" ? "danger" : "dark"}
              disabled={locked}
              onClick={() => close(true)}
            >
              {state?.confirmText ?? "Confirm"}
            </Button>
          </>
        }
      >
        {state?.confirmPhrase && (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-ink-500">
              Type <strong className="font-mono text-ink-900">{state.confirmPhrase}</strong> to confirm
            </span>
            <input
              data-autofocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="h-11 rounded-md border border-line bg-white px-3 font-mono outline-none focus:border-ink-700 focus:ring-3 focus:ring-ink-900/8"
            />
          </label>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
