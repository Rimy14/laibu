import { Users } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return (
    <ComingSoon title="Users" description="Authors, publishers and readers." icon={<Users className="size-5" />}>
      User management arrives in a later sprint.
    </ComingSoon>
  );
}
