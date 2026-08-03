"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SimulationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
        Something went wrong
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        We couldn&apos;t load this simulation
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The results page hit an unexpected error. This is usually temporary —
        try again, or head back and run a new simulation.
      </p>
      {error.message && (
        <p className="mt-3 max-w-md break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
          {error.message}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
