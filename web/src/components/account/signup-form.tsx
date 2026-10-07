"use client";

import { ArrowLeft, BookOpen, Building2, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { useSession, type User } from "@/lib/session";
import { TermsDialog, useCurrentTerms, type CurrentTerms } from "./terms";

type SignupRole = "buyer" | "author" | "publisher";

const ROLES: { value: SignupRole; title: string; text: string; icon: ReactNode }[] = [
  { value: "buyer", title: "I want to read", text: "Buy books with M-Pesa and read them on your devices.", icon: <BookOpen className="size-5" /> },
  { value: "author", title: "I'm an author", text: "Publish your own books and get paid twice a month.", icon: <PenLine className="size-5" /> },
  { value: "publisher", title: "I'm a publisher", text: "Sell books for your authors, with their approval.", icon: <Building2 className="size-5" /> },
];

const MIN = 10;

function strength(pw: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (pw.length < MIN) return { score: 0, label: `${Math.max(0, MIN - pw.length)} more characters needed` };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/, /\s/].filter((r) => r.test(pw)).length;
  if (pw.length >= 16 || variety >= 3) return { score: 3, label: "Strong" };
  if (pw.length >= 12 || variety >= 2) return { score: 2, label: "Good" };
  return { score: 1, label: "Okay. A longer phrase is safer." };
}

export function SignupForm() {
  const params = useSearchParams();
  const initialRole = params.get("role");
  const [role, setRole] = useState<SignupRole | null>(
    initialRole === "author" || initialRole === "publisher" || initialRole === "buyer" ? initialRole : null,
  );

  return role ? <DetailsStep role={role} onBack={() => setRole(null)} /> : <RoleStep onChoose={setRole} />;
}

function RoleStep({ onChoose }: { onChoose: (r: SignupRole) => void }) {
  return (
    <>
      <p className="text-sm text-ink-500">Step 1 of 2</p>
      <h1 className="mt-2 text-[2.2rem]">How will you use {BRAND.name}?</h1>
      <p className="mt-2 text-ink-500">You can always buy books, whichever you choose.</p>
      <div className="mt-8 grid gap-3">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onChoose(r.value)}
            className="group flex items-start gap-4 rounded-md border border-line bg-white p-4 text-left transition-colors hover:border-ink-900"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-cream text-ink-700 group-hover:bg-amber-100 group-hover:text-amber-700">
              {r.icon}
            </span>
            <span>
              <span className="block font-medium">{r.title}</span>
              <span className="mt-0.5 block text-sm text-ink-500">{r.text}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-8 text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4 hover:text-amber-700">
          Sign in
        </Link>
      </p>
    </>
  );
}

function DetailsStep({ role, onBack }: { role: SignupRole; onBack: () => void }) {
  const session = useSession();
  const router = useRouter();
  const toast = useToast();
  const { terms, error: termsError } = useCurrentTerms();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<keyof CurrentTerms | null>(null);
  const isCreator = role !== "buyer";
  const pw = strength(form.password);

  useEffect(() => {
    if (session.status === "authenticated") router.replace("/dashboard");
  }, [session.status, router]);

  // Editing a field clears its error straight away.
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: "" }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (form.full_name.trim().split(/\s+/).length < 2) v.full_name = "Enter your first and last name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) v.email = "Enter a valid email address.";
    if (form.phone.trim() && !/^(?:\+?254|0)?[17]\d{8}$/.test(form.phone.replace(/[\s-]/g, ""))) v.phone = "Enter a Kenyan mobile number, e.g. 0712 345 678.";
    if (form.password.length < MIN) v.password = `Use at least ${MIN} characters.`;
    if (!agreed) v.terms = "Please accept the Terms of Use and Privacy Policy.";
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length || !terms) return;


    setLoading(true);
    try {
      const res = await api<{ user: User; terms_current: boolean }>("/auth/signup", {
        method: "POST",
        body: {
          role,
          full_name: form.full_name,
          email: form.email.trim(),
          ...(form.phone.trim() ? { phone: form.phone } : {}),
          password: form.password,
          accept_terms_version: terms.terms_of_use.version,
          accept_policy_version: terms.privacy_policy.version,
        },
      });
      session.signedIn(res);
      toast.success("Your account is ready", {
        description: isCreator ? "Next, add where we should send your earnings." : "Start exploring the library.",
      });
      router.replace(isCreator ? "/dashboard" : "/#collection");
    } catch (err) {
      const e2 = err as ApiError;
      if (e2.status === 409) setErrors({ email: e2.message });
      else if (e2.status === 422 && /password|characters|common/i.test(e2.message)) setErrors({ password: e2.message });
      else if (e2.status === 422 && /mobile/i.test(e2.message)) setErrors({ phone: e2.message });
      else setFormError(e2.message);
    } finally {
      setLoading(false);
    }
  };

  const roleTitle = ROLES.find((r) => r.value === role)!.title;

  return (
    <>
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="size-4" /> {roleTitle}
      </button>
      <p className="mt-6 text-sm text-ink-500">Step 2 of 2</p>
      <h1 className="mt-2 text-[2.2rem]">Create your account</h1>

      <form onSubmit={submit} noValidate className="mt-8 grid gap-5">
        {formError && <Alert tone="danger" title={formError} />}
        {termsError && <Alert tone="danger" title="We couldn't load the terms. Please refresh the page." />}
        <Field
          label={role === "publisher" ? "Your full name (account holder)" : "Full name"}
          autoComplete="name"
          value={form.full_name}
          onChange={set("full_name")}
          error={errors.full_name}
          hint={isCreator ? "Use the name on your M-Pesa or bank account. Payouts must match it." : undefined}
          required
          autoFocus
        />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set("email")} error={errors.email} required />
        <Field
          label="Phone (optional)"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        <div>
          <PasswordField
            label="Password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            error={errors.password}
            hint="At least 10 characters. A short phrase like “green mango season” works well."
            required
          />
          {form.password && !errors.password && (
            <div className="mt-2 flex items-center gap-3" aria-live="polite">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      pw.score >= i ? (pw.score === 1 ? "bg-amber-500" : "bg-success-600") : "bg-line",
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-ink-500">{pw.label}</span>
            </div>
          )}
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                setErrors((er) => ({ ...er, terms: "" }));
              }}
              aria-invalid={errors.terms ? true : undefined}
              className="mt-1 size-4 shrink-0 accent-ink-900"
            />
            <span>
              I accept the{" "}
              <button type="button" onClick={() => setReading("terms_of_use")} className="text-ink-900 underline underline-offset-4 hover:text-amber-700">
                Terms of Use
              </button>{" "}
              and the{" "}
              <button type="button" onClick={() => setReading("privacy_policy")} className="text-ink-900 underline underline-offset-4 hover:text-amber-700">
                Privacy Policy
              </button>
              .
            </span>
          </label>
          {errors.terms && (
            <p role="alert" className="mt-1.5 text-[0.8rem] text-danger-600">
              {errors.terms}
            </p>
          )}
        </div>

        <Button type="submit" variant="dark" size="lg" loading={loading} loadingText="Creating your account…" disabled={!terms} className="mt-1 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-8 text-sm text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-ink-900 underline underline-offset-4 hover:text-amber-700">
          Sign in
        </Link>
      </p>

      <TermsDialog open={reading !== null} initial={reading ?? undefined} onClose={() => setReading(null)} />
    </>
  );
}
