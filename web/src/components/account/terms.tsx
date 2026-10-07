"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

export interface TermsDocument {
  version: string;
  title: string;
  content_md: string;
  published_at: string;
}
export interface CurrentTerms {
  terms_of_use: TermsDocument;
  privacy_policy: TermsDocument;
}

export function useCurrentTerms(enabled = true) {
  const [terms, setTerms] = useState<CurrentTerms | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api<CurrentTerms>("/terms/current")
      .then((t) => alive && setTerms(t))
      .catch((e: ApiError) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { terms, error };
}

/**
 * The text is shown as plain paragraphs, never rendered as HTML, so nothing
 * inside a terms document can run in the page.
 */
export function TermsText({ doc }: { doc: TermsDocument }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed text-ink-700">
      {doc.content_md.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="whitespace-pre-line">
          {para.replace(/^#+\s*/, "")}
        </p>
      ))}
      <p className="pt-2 text-xs text-ink-400">
        Version {doc.version} · published {new Date(doc.published_at).toLocaleDateString("en-KE", { dateStyle: "long" })}
      </p>
    </div>
  );
}

/** Two-tab reader for the Terms of Use and Privacy Policy. */
export function TermsTabs({ terms, initial = "terms_of_use" }: { terms: CurrentTerms; initial?: keyof CurrentTerms }) {
  const [tab, setTab] = useState<keyof CurrentTerms>(initial);
  return (
    <div>
      <div role="tablist" aria-label="Documents" className="flex gap-1 border-b border-line">
        {(["terms_of_use", "privacy_policy"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === k ? "border-ink-900 font-medium text-ink-900" : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {terms[k].title}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4 max-h-[45vh] overflow-y-auto rounded-md bg-cream/70 p-4">
        <TermsText doc={terms[tab]} />
      </div>
    </div>
  );
}

/** "Read the terms" dialog used from the signup checkbox. */
export function TermsDialog({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial?: keyof CurrentTerms;
}) {
  const { terms, error } = useCurrentTerms(open);
  return (
    <Modal open={open} onClose={onClose} title="Terms and privacy" size="lg" footer={<Button variant="dark" onClick={onClose}>Close</Button>}>
      {error ? <Alert tone="danger" title={error} /> : terms ? <TermsTabs terms={terms} initial={initial} /> : <TermsSkeleton />}
    </Modal>
  );
}

function TermsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-60" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * §9 gate: when the signed-in user hasn't accepted the current terms (on load,
 * or when any request returns 428), this blocks the app until they accept.
 * The only other way out is signing out.
 */
export function TermsGate() {
  const session = useSession();
  const toast = useToast();
  const open = session.status === "authenticated" && !session.termsCurrent && session.user?.role !== "superadmin";
  const { terms, error } = useCurrentTerms(open);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const accept = async () => {
    if (!terms) return;
    setSaving(true);
    try {
      await api("/auth/terms/accept", {
        method: "POST",
        body: { accept_terms_version: terms.terms_of_use.version, accept_policy_version: terms.privacy_policy.version },
      });
      await session.reload();
      toast.success("Thank you", { description: "You've accepted the updated terms." });
    } catch (e) {
      toast.error("Couldn't save your acceptance", { description: (e as ApiError).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => undefined}
      dismissible={false}
      size="lg"
      title="We've updated our terms"
      description="Please read and accept the latest Terms of Use and Privacy Policy to keep using Laibu."
      footer={
        <>
          <Button variant="ghost" onClick={() => void session.signOut()} disabled={saving}>
            Sign out
          </Button>
          <Button variant="dark" onClick={accept} loading={saving} loadingText="Saving…" disabled={!agreed || !terms}>
            Accept and continue
          </Button>
        </>
      }
    >
      {error ? (
        <Alert tone="danger" title={error} />
      ) : terms ? (
        <>
          <TermsTabs terms={terms} />
          <label className="mt-5 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-4 accent-ink-900"
            />
            <span>I have read and accept the Terms of Use and the Privacy Policy.</span>
          </label>
        </>
      ) : (
        <TermsSkeleton />
      )}
    </Modal>
  );
}
