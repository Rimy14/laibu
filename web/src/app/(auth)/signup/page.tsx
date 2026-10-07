import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthLayout } from "@/components/account/auth-layout";
import { SignupForm } from "@/components/account/signup-form";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <AuthLayout
      aside={{
        title: <>Read, write, <em>and get paid</em> in one place.</>,
        text: "Readers pay with M-Pesa. Authors and publishers are paid on the 2nd and 4th Thursday of every month.",
      }}
    >
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthLayout>
  );
}
