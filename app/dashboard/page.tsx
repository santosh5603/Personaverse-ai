"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Mode = "youtube" | "image";

interface PastSim {
  id: string;
  contentType: string;
  sourceUrl: string | null;
  contextText: string | null;
  status: string;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [contextText, setContextText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [past, setPast] = useState<PastSim[] | null>(null);

  async function loadPast() {
    try {
      const res = await fetch("/api/simulations");
      if (res.ok) {
        const data = await res.json();
        setPast(data.simulations);
      } else {
        setPast([]);
      }
    } catch {
      setPast([]);
    }
  }

  useEffect(() => {
    loadPast();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      let res: Response;
      if (mode === "youtube") {
        res = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: "youtube", youtubeUrl, contextText }),
        });
      } else {
        if (!imageFile) {
          setError("Please choose an image to upload.");
          setSubmitting(false);
          return;
        }
        const form = new FormData();
        form.append("imageFile", imageFile);
        form.append("contextText", contextText);
        res = await fetch("/api/simulations", { method: "POST", body: form });
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      router.push(`/simulation/${data.simulationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">New simulation</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Test content against 1,000 simulated audience personas.
      </p>

      <Card className="mt-6">
        <CardContent className="pt-6">
          {submitting ? (
            <SimulatingState />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="inline-flex rounded-lg border p-1">
                <button
                  type="button"
                  onClick={() => setMode("youtube")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    mode === "youtube"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  YouTube URL
                </button>
                <button
                  type="button"
                  onClick={() => setMode("image")}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    mode === "image"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload Image
                </button>
              </div>

              {mode === "youtube" ? (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    YouTube video URL
                  </label>
                  <Input
                    type="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    We fetch the public thumbnail only.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium">
                    Image (Instagram post, ad creative, product photo)
                  </label>
                  <Input
                    type="file"
                    accept="image/*"
                    required
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Context <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  placeholder="Caption, campaign goal, or any context for the audience..."
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  rows={3}
                />
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full">
                Run simulation
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Past simulations</h2>
        <div className="mt-3 space-y-2">
          {past === null ? (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : past.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              No simulations yet. Run your first one above.
            </p>
          ) : (
            past.map((s) => (
              <Link key={s.id} href={`/simulation/${s.id}`}>
                <Card className="transition hover:border-foreground/30">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 py-4">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm font-medium">
                        {s.contentType === "youtube"
                          ? (s.sourceUrl ?? "YouTube video")
                          : (s.contextText || "Uploaded image")}
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(s.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant={s.status === "complete" ? "default" : "secondary"}>
                      {s.status}
                    </Badge>
                  </CardHeader>
                </Card>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function SimulatingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      <div>
        <p className="font-medium">Simulating 1,000 personas…</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Stratifying the population and running representatives through the
          audience model. This takes ~15–30 seconds.
        </p>
      </div>
      <div className="mt-2 w-full max-w-sm space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}
