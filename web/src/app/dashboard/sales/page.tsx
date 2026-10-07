import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Sales" };

export default function Page() {
  return (
    <ComingSoon title="Sales" description="Every sale of your books, with your share." icon={<BarChart3 className="size-5" />}>
      Sales reports arrive once M-Pesa checkout is live.
    </ComingSoon>
  );
}
