import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/account/auth-layout";
import { LoginForm } from "@/components/account/login-form";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };

// Served at admin.<domain>/login (see src/proxy.ts)
export default function AdminLoginPage() {
  return (
    <AuthLayout logoSuffix="Admin" logoHref="/login">
      <Suspense>
        <LoginForm area="admin" />
      </Suspense>
    </AuthLayout>
  );
}
