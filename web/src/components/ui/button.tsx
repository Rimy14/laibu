import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "dark" | "outline" | "outline-light" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap " +
  "transition-colors duration-150 " +
  "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Amber is the brand accent: used for the single most important action on a page.
  primary: "bg-amber-500 text-ink-900 hover:bg-amber-400",
  dark: "bg-ink-900 text-white hover:bg-ink-700",
  outline: "border border-line bg-paper text-ink-900 hover:border-ink-300 hover:bg-cream",
  "outline-light": "border border-white/20 text-white hover:border-white/50 hover:bg-white/5",
  ghost: "text-ink-700 hover:bg-ink-900/5",
  danger: "bg-danger-600 text-white hover:bg-danger-600/90",
};

// md/lg keep a 44px+ tap target (WCAG 2.5.5)
const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, blocks double-submits and announces "busy" to screen readers. */
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingText,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant = "primary", size = "md", icon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
