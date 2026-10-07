"use client";

import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { BookCover } from "@/components/public/book-cover";
import { SecureView, type CaptureEvent } from "@/components/secure/secure-view";
import { Button } from "@/components/ui/button";
import { Modal, useConfirm } from "@/components/ui/dialog";
import { Alert, Badge, EmptyState } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import { BookGridSkeleton, Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { SAMPLE_BOOKS } from "@/lib/sample-books";

const SWATCHES = [
  ["ink-900", "bg-ink-900"],
  ["ink-500", "bg-ink-500"],
  ["amber-500", "bg-amber-500"],
  ["amber-700", "bg-amber-700"],
  ["cream", "bg-cream border border-line"],
  ["success-600", "bg-success-600"],
  ["danger-600", "bg-danger-600"],
  ["info-600", "bg-info-600"],
] as const;

export function Showcase() {
  const toast = useToast();
  const confirm = useConfirm();
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [events, setEvents] = useState<string[]>([]);

  const fakeSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1400));
    setSaving(false);
    toast.success("Payout method saved", { description: "M-Pesa •••• 5678 will receive your next payout." });
  };

  const onCapture = (e: CaptureEvent) => {
    setEvents((list) => [`${new Date().toLocaleTimeString()}: ${e}`, ...list].slice(0, 6));
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-14 sm:px-6">
      <header>
        <Badge tone="amber">Development only</Badge>
        <h1 className="mt-3 text-4xl">Laibu design system</h1>
        <p className="mt-2 text-ink-500">Every screen is built from these pieces. Not available in production.</p>
      </header>

      <Section title="Colour">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="overflow-hidden rounded-lg border border-line bg-white">
              <div className={`h-16 ${cls}`} />
              <p className="px-3 py-2 font-mono text-xs">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <p className="text-sm font-medium text-amber-700">Eyebrow</p>
        <p className="font-serif text-5xl">Display heading</p>
        <p className="font-serif text-3xl">Section heading</p>
        <p className="text-lg font-medium">Card title</p>
        <p className="max-w-2xl leading-relaxed text-ink-500">
          Headings use Newsreader, an editorial serif, at regular weight. Body text is Instrument Sans at 16px with relaxed line-height, for easy reading on phones.
        </p>
      </Section>

      <Section title="Buttons & loading">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="dark">Dark</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" icon={<Trash2 className="size-4" />}>
            Delete
          </Button>
          <Button loading loadingText="Saving…">
            Save
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm" variant="outline" icon={<Download className="size-4" />}>
            Small
          </Button>
        </div>
      </Section>

      <Section title="Popups">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => toast.success("Book submitted for review", { description: "We'll email you when it's approved." })}>
            Success toast
          </Button>
          <Button variant="outline" onClick={() => toast.error("Payment failed", { description: "The M-Pesa request was cancelled. You have not been charged." })}>
            Error toast
          </Button>
          <Button variant="outline" onClick={() => toast.warning("Name doesn't match", { description: "The account name must match your registered name." })}>
            Warning toast
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              toast.info("New version of the Terms", { action: { label: "Review now", onClick: () => setModalOpen(true) } })
            }
          >
            Info + action
          </Button>
          <Button
            variant="dark"
            onClick={async () => {
              const ok = await confirm({
                title: "Approve this book?",
                description: "It will go live on the storefront immediately.",
                confirmText: "Approve",
              });
              toast[ok ? "success" : "info"](ok ? "Book approved" : "Nothing changed");
            }}
          >
            Confirm dialog
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirm({
                title: "Mark payout as paid?",
                description: "This locks 14 ledger lines and notifies the payee. It cannot be undone.",
                confirmText: "Mark paid",
                tone: "danger",
                confirmPhrase: "MARK PAID",
              });
              if (ok) toast.success("Marked as paid");
            }}
          >
            Typed confirmation
          </Button>
          <Button variant="outline" onClick={() => setModalOpen(true)}>
            Modal
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Updated Terms of Use"
          description="Please review and accept to keep using Laibu."
          footer={
            <>
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                Later
              </Button>
              <Button onClick={() => setModalOpen(false)}>I accept</Button>
            </>
          }
        >
          <div className="max-h-48 overflow-y-auto rounded-xl bg-cream p-4 text-sm text-ink-700">
            Terms text appears here, scrollable, with the version number and date.
          </div>
        </Modal>
      </Section>

      <Section title="Forms">
        <form
          className="grid max-w-xl gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void fakeSave();
          }}
        >
          <Field label="Full name" required hint="Must match your M-Pesa or bank account name." defaultValue="Wanjiru Kamau" />
          <Field label="M-Pesa number" required leading="+254" inputMode="numeric" placeholder="712 345 678" error="Enter the 9 digits after +254." />
          <PasswordField label="Password" required hint="At least 12 characters." autoComplete="new-password" />
          <div>
            <Button type="submit" loading={saving} loadingText="Saving…">
              Save payout method
            </Button>
          </div>
        </form>
      </Section>

      <Section title="Alerts & badges">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="DRM processing">Your book is being encrypted. This usually takes a minute.</Alert>
          <Alert tone="success" title="Approved">&quot;Salt on the Savannah&quot; is now live.</Alert>
          <Alert tone="warning" title="Payout on hold">Your account name doesn&apos;t match your profile name.</Alert>
          <Alert tone="danger" title="Rejected">The cover image is missing. Fix it and resubmit.</Alert>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>draft</Badge>
          <Badge tone="amber">pending_admin</Badge>
          <Badge tone="info">pending_author</Badge>
          <Badge tone="success">live</Badge>
          <Badge tone="danger">rejected</Badge>
          <Badge tone="dark">Laibu pick</Badge>
        </div>
      </Section>

      <Section title="Loading states">
        <div className="grid gap-8 lg:grid-cols-2">
          <BookGridSkeleton count={2} />
          <div className="flex flex-col gap-6">
            <TableSkeleton rows={3} />
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <LoadingBlock label="Loading your library…" className="rounded-lg border border-line bg-white" />
          </div>
        </div>
      </Section>

      <Section title="Empty state">
        <EmptyState title="No sales yet" action={<Button variant="outline">Share your book</Button>}>
          When someone buys your book, it will show up here.
        </EmptyState>
      </Section>

      <Section title="Protected content (black-screen)">
        <p className="mb-4 max-w-2xl text-sm text-ink-500">
          Press PrintScreen, hold the Windows/Cmd key, press Ctrl+P, or switch to another window. The content goes black.
          Copy and right-click are blocked. The watermark carries the buyer&apos;s identity.
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <SecureView watermark="buyer@example.com · #A1B2C3" onCaptureAttempt={onCapture} className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="grid gap-6 p-6 sm:grid-cols-[160px_1fr]">
              <BookCover title={SAMPLE_BOOKS[2].title} author={SAMPLE_BOOKS[2].author} cover={SAMPLE_BOOKS[2].cover} />
              <div className="space-y-3 text-[0.95rem] leading-relaxed text-ink-700">
                <p className="text-lg font-medium text-ink-900">Chapter One</p>
                <p>The rains came late that year. Achieng watched the horizon from the doorway, counting the days the way her grandmother had taught her.</p>
                <p>Sample reader text, to show the protection layer working on real content.</p>
              </div>
            </div>
          </SecureView>
          <div className="rounded-lg border border-line bg-white p-4">
            <p className="text-sm font-medium">Reported to admin</p>
            <p className="text-xs text-ink-500">Sent to the API with device details in the reader sprint.</p>
            <ul className="mt-3 space-y-1.5 font-mono text-xs text-ink-700">
              {events.length ? events.map((e) => <li key={e}>{e}</li>) : <li className="text-ink-400">No attempts yet</li>}
            </ul>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 border-b border-line pb-3 text-sm font-medium text-ink-500">{title}</h2>
      {children}
    </section>
  );
}
