import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SimulationNotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        404
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        Simulation not found
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This simulation doesn&apos;t exist, or it belongs to another account.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
