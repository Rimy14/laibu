"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

// Shown when a page crashes. Never displays technical details to the user.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid flex-1 place-items-center bg-cream px-4 py-24">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-lg bg-danger-50 text-danger-600">
          <TriangleAlert className="size-8" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl">Something went wrong</h1>
        <p className="mt-3 text-ink-500">
          Please try again. If it keeps happening, contact support
          {error.digest ? (
            <>
              {" "}
              and quote <code className="rounded bg-white px-1.5 py-0.5 text-sm">{error.digest}</code>
            </>
          ) : null}
          .
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={reset} icon={<RotateCw className="size-4" />}>
            Try again
          </Button>
          <ButtonLink href="/" variant="outline">
            Home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
