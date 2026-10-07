import { Alert } from "@/components/ui/feedback";

/** Shown until the client's lawyer supplies the real text (docs/TERMS_OF_USE.md, docs/PRIVACY_POLICY.md). */
export function LegalPlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
      <p className="text-sm font-medium text-amber-700">Legal</p>
      <h1 className="mt-3 text-4xl">{title}</h1>
      <Alert tone="warning" title="This page is being prepared" className="mt-8">
        The final text is being written by our legal team and will be published here before launch.
      </Alert>
    </div>
  );
}
