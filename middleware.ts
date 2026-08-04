import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher(["/dashboard(.*)", "/simulation(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // The /api/test-* routes are unauthenticated dev scaffolding (some run the
  // full LLM pipeline and write to the DB). Never expose them in production.
  if (
    process.env.NODE_ENV === "production" &&
    req.nextUrl.pathname.startsWith("/api/test")
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Everything except Next internals and static files, unless in a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
