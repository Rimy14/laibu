import { BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { ComingSoon } from "@/components/account/coming-soon";

export const metadata: Metadata = { title: "My books" };

export default function Page() {
  return (
    <ComingSoon title="My books" description="Upload, track and manage your books." icon={<BookOpen className="size-5" />}>
      Book upload, encryption and review arrive in the next release.
    </ComingSoon>
  );
}
