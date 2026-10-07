import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/account-shell";

export const metadata: Metadata = { title: { default: "Your account", template: "%s · Laibu" }, robots: { index: false } };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}
