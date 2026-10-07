import { BookCheck } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Approvals" };

export default function Page() {
  return (
    <ComingSoon title="Approvals" description="Books waiting for your review." icon={<BookCheck className="size-5" />}>
      The review queue arrives with book upload in Sprint 2.
    </ComingSoon>
  );
}
