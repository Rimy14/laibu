"use client";

import { BarChart3, BookOpen, Home, Library, Settings, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardShell, type NavItem } from "@/components/shell/dashboard-shell";
import { useSession } from "@/lib/session";

const CREATOR_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <Home />, primary: true },
  { href: "/dashboard/books", label: "My books", icon: <BookOpen />, primary: true },
  { href: "/dashboard/sales", label: "Sales", icon: <BarChart3 />, primary: true },
  { href: "/dashboard/payouts", label: "Payouts", icon: <Wallet />, primary: true },
  { href: "/dashboard/library", label: "My library", icon: <Library /> },
  { href: "/dashboard/settings", label: "Settings", icon: <Settings />, primary: true },
];

const READER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <Home />, primary: true },
  { href: "/dashboard/library", label: "My library", icon: <Library />, primary: true },
  { href: "/dashboard/settings", label: "Settings", icon: <Settings />, primary: true },
];

/** Author, publisher and reader accounts. The superadmin uses the admin host instead. */
export function AccountShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const nav = user?.role === "buyer" ? READER_NAV : CREATOR_NAV;
  return (
    <DashboardShell nav={nav} area="account" roles={["author", "publisher", "buyer"]}>
      {children}
    </DashboardShell>
  );
}
