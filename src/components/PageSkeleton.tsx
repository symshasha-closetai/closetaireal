import { Skeleton } from "@/components/ui/skeleton";

const PageSkeleton = () => {
  return (
    <div className="min-h-screen bg-background px-5 pt-4 pb-24">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* Hero card skeleton */}
        <Skeleton className="h-48 w-full rounded-2xl" />

        {/* Section title */}
        <Skeleton className="h-5 w-40 rounded-lg" />

        {/* Grid of cards */}
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>

        {/* Another section */}
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="h-32 w-full rounded-2xl" />

        {/* Action buttons */}
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default PageSkeleton;
