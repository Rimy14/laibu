import { Skeleton, BookGridSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="mt-14">
        <BookGridSkeleton count={8} />
      </div>
    </div>
  );
}
