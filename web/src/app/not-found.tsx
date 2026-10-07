import { BookX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center bg-cream px-4 py-24">
      <div className="text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-lg bg-amber-500 text-ink-900">
          <BookX className="size-8" aria-hidden />
        </div>
        <p className="mt-6 text-sm font-medium text-amber-700">Error 404</p>
        <h1 className="mt-2 text-3xl">This page isn&apos;t on our shelves</h1>
        <p className="mx-auto mt-3 max-w-sm text-ink-500">The link may be broken, or the page may have moved.</p>
        <ButtonLink href="/" className="mt-8" variant="dark">
          Back to home
        </ButtonLink>
      </div>
    </main>
  );
}
