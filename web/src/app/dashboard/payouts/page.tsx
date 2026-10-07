import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Payouts" };

export default function Page() {
  return (
    <ComingSoon title="Payouts" description="What you've been paid and what's coming." icon={<Wallet className="size-5" />}>
      Payout statements arrive with the payout cycle feature.
    </ComingSoon>
  );
}
