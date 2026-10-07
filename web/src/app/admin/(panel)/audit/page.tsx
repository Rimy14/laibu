import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <ComingSoon title="Audit log" description="Every superadmin action, permanently recorded." icon={<ScrollText className="size-5" />}>
      The audit log viewer arrives in Sprint 7. Actions are already being recorded.
    </ComingSoon>
  );
}
