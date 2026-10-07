"use client";

import { BookCheck, FileText, LayoutDashboard, ScrollText, ShieldAlert, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavItem } from "./dashboard-shell";

// Served only on the admin host (see src/proxy.ts); links have no /admin prefix
// because that is what the browser sees.
const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard />, primary: true },
  { href: "/approvals", label: "Approvals", icon: <BookCheck />, primary: true },
  { href: "/payouts", label: "Payouts", icon: <Wallet />, primary: true },
  { href: "/users", label: "Users", icon: <Users /> },
  { href: "/security", label: "Security events", icon: <ShieldAlert /> },
  { href: "/audit", label: "Audit log", icon: <ScrollText /> },
  { href: "/terms", label: "Terms versions", icon: <FileText />, primary: true },
];

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <DashboardShell nav={NAV} area="admin" roles={["superadmin"]}>
      {children}
    </DashboardShell>
  );
}
