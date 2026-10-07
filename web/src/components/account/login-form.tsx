"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import { useSession, type User } from "@/lib/session";
import { safeNext } from "./auth-layout";

/** Shared by the public sign-in and the admin sign-in; only the endpoint and copy differ. */
export function LoginForm({ area }: { area: "account" | "admin" }) {
  const session = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const home = area === "admin" ? "/" : "/dashboard";
  const next = safeNext(params.get("next"), home);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Already signed in? Go straight on.
  useEffect(() => {
    if (session.status === "authenticated") router.replace(next);
  }, [session.status, router, next]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) v.email = "Enter the email you signed up with.";
    if (!password) v.password = "Enter your password.";
    setErrors(v);
    setFormError(null);
    if (Object.keys(v).length) return;

    setLoading(true);
    try {
      const res = await api<{ user: User; terms_current: boolean }>(area === "admin" ? "/admin/auth/login" : "/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      session.signedIn(res);
      toast.success(`Welcome back, ${res.user.full_name.split(" ")[0]}`);
      router.replace(next);
    } catch (err) {
      setFormError((err as ApiError).message);
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h1 className="text-[2.2rem]">{area === "admin" ? "Admin sign in" : "Welcome back"}</h1>
      <p className="mt-2 text-ink-500">
        {area === "admin" ? `Sign in to manage ${BRAND.name}.` : "Sign in to your library and dashboard."}
      </p>

      <form onSubmit={submit} noValidate className="mt-9 grid gap-5">
        {formError && <Alert tone="danger" title={formError} />}
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((er) => ({ ...er, email: undefined }));
          }}
          error={errors.email}
          autoFocus
        />
        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setErrors((er) => ({ ...er, password: undefined }));
          }}
          error={errors.password}
        />
        <Button type="submit" variant="dark" size="lg" loading={loading} loadingText="Signing in…" className="mt-1 w-full">
          Sign in
        </Button>
      </form>

      {area === "account" ? (
        <div className="mt-8 space-y-2 text-sm text-ink-500">
          <p>
            New to {BRAND.name}?{" "}
            <Link href="/signup" className="font-medium text-ink-900 underline underline-offset-4 hover:text-amber-700">
              Create an account
            </Link>
          </p>
          <p>
            Forgot your password?{" "}
            <a href={`mailto:${BRAND.supportEmail}`} className="text-ink-900 underline underline-offset-4 hover:text-amber-700">
              Contact support
            </a>
          </p>
        </div>
      ) : (
        <p className="mt-8 text-sm text-ink-400">This area is for {BRAND.name} administrators. Every sign-in is recorded.</p>
      )}
    </>
  );
}
