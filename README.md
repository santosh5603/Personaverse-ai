# PersonaVerse AI

Multi-agent audience simulation. Submit a YouTube URL (thumbnail auto-fetched)
or upload an image, and the app simulates a 1,000-person audience, scores the
content on attention / trust / engagement / likelihood-to-act, and returns an
insight report with a predicted-reach forecast, a population matrix, an
interactive persona map, and concrete suggestions to improve the content.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind + shadcn/ui · MongoDB Atlas
(Mongoose) · Clerk auth · Google Gemini (with an OpenRouter fallback) · Zod.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

> Note: `mongodb+srv://` may fail on some networks (SRV DNS) or where outbound
> port 27017 is blocked. If so, use the standard (non-SRV) Atlas URI or a local
> MongoDB. See `.env.example`.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, **Add New → Project** and import the repo (framework auto-detected
   as Next.js; no root-directory override needed).
3. Add the environment variables from `.env.example` under
   **Settings → Environment Variables**. Use the **SRV** Mongo URI on Vercel:
   `mongodb+srv://…@cluster0.<host>.mongodb.net/personaverse?retryWrites=true&w=majority`
4. In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0` (Vercel has no
   static egress IPs).
5. Deploy.

The API routes declare `runtime = "nodejs"` and `maxDuration = 60` (within
Vercel Hobby's limit). The `/api/test-*` routes are dev-only and return 404 in
production.

## Environment variables

See [`.env.example`](./.env.example) for the full list and notes. Required:
`MONGODB_URI`, `GEMINI_API_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`.
