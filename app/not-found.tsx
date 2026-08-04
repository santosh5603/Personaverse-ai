import Link from "next/link";

// Root 404. Kept dependency-free (no Clerk components) so it prerenders
// cleanly at build time even before env vars are configured.
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <div className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        404
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go home
      </Link>
    </main>
  );
}
