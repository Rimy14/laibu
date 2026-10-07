import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { EmptyState } from "@/components/ui/feedback";

/** Placeholder for sections that arrive in later sprints, so no nav link leads to a 404. */
export function ComingSoon({ title, description, icon, children }: { title: string; description: string; icon: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState icon={icon} title="Coming soon">
        {children}
      </EmptyState>
    </>
  );
}
