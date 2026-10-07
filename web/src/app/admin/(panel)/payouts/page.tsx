import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Payouts" };

export default function Page() {
  return (
    <ComingSoon title="Payouts" description="Payout cycles, reports and mark-paid." icon={<Wallet className="size-5" />}>
      Payout cycles arrive in Sprint 6.
    </ComingSoon>
  );
}
