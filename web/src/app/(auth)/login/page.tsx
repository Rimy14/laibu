import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/account/auth-layout";
import { LoginForm } from "@/components/account/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthLayout aside={{ title: <>Your library, <em>wherever you read.</em></>, text: "Books you buy open on up to three of your own devices, protected and always yours." }}>
      <Suspense>
        <LoginForm area="account" />
      </Suspense>
    </AuthLayout>
  );
}
