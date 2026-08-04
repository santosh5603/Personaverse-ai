import Link from "next/link";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

// Rendered dynamically so the build never needs Clerk keys to prerender it.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    n: "01",
    title: "Drop in content",
    body: "Paste a YouTube URL (we grab the thumbnail) or upload an image — an ad, a Reel screenshot, a product shot.",
  },
  {
    n: "02",
    title: "Simulate 1,000 personas",
    body: "We generate a 1,000-person audience, stratify it into segments, and run representatives through a multimodal model.",
  },
  {
    n: "03",
    title: "Read the consensus",
    body: "Attention, trust, engagement and likelihood-to-act — plus an insight report and an explorable persona map.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="flex flex-col items-center py-20 text-center md:py-28">
        <span className="mb-4 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Multi-agent audience simulation
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
          See how 1,000 people react{" "}
          <span className="text-primary">before you post.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          PersonaVerse AI runs your video thumbnail or image ad past a simulated
          audience and returns scored, segment-level feedback in seconds.
        </p>

        <div className="mt-8 flex gap-3">
          <SignedIn>
            <Button asChild size="lg">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button size="lg">Get started</Button>
            </SignInButton>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </SignedOut>
        </div>
      </section>

      {/* How it works */}
      <section className="grid gap-6 pb-24 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.n} className="rounded-xl border p-6">
            <div className="text-sm font-semibold text-primary">{s.n}</div>
            <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
