import { Library } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "My library" };

export default function Page() {
  return (
    <ComingSoon title="My library" description="Books you've bought." icon={<Library className="size-5" />}>
      Your purchased books will appear here once checkout is live.
    </ComingSoon>
  );
}
