import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Security events" };

export default function Page() {
  return (
    <ComingSoon title="Security events" description="Capture attempts on protected pages, with device details." icon={<ShieldAlert className="size-5" />}>
      Reporting arrives with the book reader.
    </ComingSoon>
  );
}
