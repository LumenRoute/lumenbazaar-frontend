import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { DiscoveryDensity } from "@/services/settings";

/**
 * Skeleton geometry shared by catalog loading states. Every measurement mirrors
 * `ResourceCard` so loading never shifts the page or announces a result count.
 */
export function ResourceCardSkeleton({ density = "comfortable" }: { density?: DiscoveryDensity }) {
  const compact = density === "compact";

  return (
    <div aria-hidden="true">
      <Card className="overflow-hidden">
        <CardHeader className={cn("flex flex-col gap-3", compact ? "py-2" : "")}>
          <div
            className={cn(
              "animate-pulse rounded-sm bg-slate-200",
              compact ? "h-4 w-40" : "h-5 w-48"
            )}
          />
          <div
            className={cn(
              "animate-pulse rounded-sm bg-slate-100",
              compact ? "h-3 w-3/4" : "h-4 w-3/4"
            )}
          />
          <div
            className={cn(
              "animate-pulse rounded-sm bg-slate-100",
              compact ? "h-3 w-1/2" : "h-4 w-1/2"
            )}
          />
        </CardHeader>
        <CardBody className={cn(compact ? "space-y-2 py-3" : "space-y-4")}>
          <div
            className={cn(
              "grid gap-x-4 gap-y-2",
              compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 xl:grid-cols-4"
            )}
          >
            {[0, 1, 2, 3].map((field) => (
              <div className="space-y-1" key={field}>
                <div className="h-3 w-14 animate-pulse rounded-sm bg-slate-100" />
                <div className="h-3.5 w-20 animate-pulse rounded-sm bg-slate-200" />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100" />
            <div className="h-6 w-28 animate-pulse rounded-full bg-slate-100" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/**
 * Renders a fixed number of skeletons. The announcement contains no count, so
 * assistive technology never hears a fabricated result total while loading.
 */
export function ResourceCardSkeletonList({
  count = 3,
  density
}: {
  count?: number;
  density?: DiscoveryDensity;
}) {
  return (
    <div aria-label="Loading catalog results" className="grid gap-3" role="status">
      <span className="sr-only">Loading resources</span>
      {Array.from({ length: count }, (_, index) => (
        <ResourceCardSkeleton density={density} key={index} />
      ))}
    </div>
  );
}
