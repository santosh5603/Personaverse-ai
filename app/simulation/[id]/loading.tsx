import { Skeleton } from "@/components/ui/skeleton";

export default function SimulationLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-6 h-28 w-full" />
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <Skeleton className="mt-8 h-[460px] w-full" />
    </main>
  );
}
