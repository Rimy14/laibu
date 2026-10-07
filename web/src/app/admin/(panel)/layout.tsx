import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Laibu Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
