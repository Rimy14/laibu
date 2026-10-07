"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const inputBase =
  "block w-full rounded-md border bg-white px-3.5 text-[0.95rem] text-ink-900 placeholder:text-ink-400 " +
  "transition-[border-color,box-shadow] duration-150 outline-none " +
  "focus:border-ink-700 focus:ring-3 focus:ring-ink-900/8 " +
  "disabled:cursor-not-allowed disabled:bg-cream disabled:text-ink-500";

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  hint?: ReactNode;
  error?: string;
  /** Element shown inside the field on the left, e.g. a "+254" prefix. */
  leading?: ReactNode;
}

/**
 * Labelled input with hint + error wired for screen readers.
 * Errors say what to do ("Enter a 10-digit M-Pesa number"), not only what's wrong.
 */
export function Field({ label, hint, error, leading, className, id, required, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
        {required && <span className="ml-0.5 text-danger-600" aria-hidden>*</span>}
      </label>
      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[0.95rem] text-ink-500">
            {leading}
          </span>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            inputBase,
            "h-11",
            leading ? "pl-15" : undefined,
            error ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/15" : "border-line hover:border-ink-300",
          )}
          {...props}
        />
      </div>
      {hint && !error && (
        <p id={hintId} className="text-[0.8rem] text-ink-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[0.8rem] font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Password field with a show/hide toggle (reduces typos without weakening security). */
export function PasswordField(props: Omit<FieldProps, "type" | "leading">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Field {...props} type={visible ? "text" : "password"} className={cn(props.className, "[&_input]:pr-12")} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-[1.85rem] grid size-9 place-items-center rounded-md text-ink-500 hover:bg-cream hover:text-ink-900"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
      </button>
    </div>
  );
}

interface TextAreaProps extends ComponentProps<"textarea"> {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextArea({ label, hint, error, className, id, ...props }: TextAreaProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-ink-900">
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(inputBase, "min-h-28 py-3", error ? "border-danger-600" : "border-line hover:border-ink-300")}
        {...props}
      />
      {hint && !error && <p className="text-[0.8rem] text-ink-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-[0.8rem] font-medium text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
