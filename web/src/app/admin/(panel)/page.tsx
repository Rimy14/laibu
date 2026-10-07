import Link from "next/link";
import { PageHeader, StatCard } from "@/components/shell/dashboard-shell";
import { Alert } from "@/components/ui/feedback";

export default function AdminOverview() {
  return (
    <>
      <PageHeader title="Overview" description="What needs your attention today." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting approval" value="0" hint="Book review arrives in Sprint 2" />
        <StatCard label="Next payday" value="Thu 8 Oct" hint="Report generates at 00:05 EAT" />
        <StatCard label="Payouts on hold" value="0" />
        <StatCard label="Capture attempts (7 days)" value="0" />
      </div>
      <Alert tone="info" title="More tools arrive sprint by sprint" className="mt-8">
        Book approvals come in Sprint 2, then payouts in Sprint 6. You can already manage the{" "}
        <Link href="/terms" className="underline underline-offset-4">
          Terms and Privacy versions
        </Link>{" "}
        users must accept.
      </Alert>
    </>
  );
}
