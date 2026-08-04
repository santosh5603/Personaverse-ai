<div align="center">

# 🧠 PersonaVerse AI

### Test your content on 1,000 people before you post it.

PersonaVerse AI is a multi-agent audience simulator. Give it a YouTube
thumbnail or an image ad, and it predicts how a diverse, 1,000-person audience
will react — attention, trust, engagement, and likelihood to act — then shows
you *who* responds, *how far* it could spread, and *what to change* to make it
land better.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?logo=tailwindcss&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Gemini](https://img.shields.io/badge/Google-Gemini-4285F4?logo=googlegemini&logoColor=white)
![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF)

</div>

---

## The problem

Creators and marketers publish first and learn later. A/B testing needs live
traffic, focus groups are slow and expensive, and a single "gut-feel" opinion
doesn't represent the messy diversity of a real audience. By the time the
analytics come in, the thumbnail or ad is already out there.

## The idea

Instead of testing on real people after publishing, **simulate the audience
beforehand.** PersonaVerse builds a synthetic population of 1,000 distinct
personas — different ages, professions, temperaments, and communication styles
— and runs your content past a representative cross-section of them using a
multimodal AI model. The result is segment-level, predictive feedback in
seconds, for the price of a couple dozen model calls instead of a thousand.

---

## ✨ What it does

- **Two inputs, zero friction** — paste a YouTube URL (the public thumbnail is
  fetched automatically) or upload any image: an ad creative, a Reel
  screenshot, a product shot.
- **Four core scores** — every persona rates the content 0–100 on **Attention**,
  **Trust**, **Engagement**, and **Likelihood to Act**, in their own voice.
- **Predicted reach** — an animated forecast of cumulative views (out of a
  1,000,000 ceiling) over the first day, week, month, and year.
- **Population matrix** — a 1,000-dot grid showing exactly how many people would
  *see it*, *engage*, *trust it*, or *click* — filterable and animated.
- **Interactive persona map** — an Obsidian-style force-directed graph. Pan,
  zoom, and click any node to read that persona's traits, scores, and reasoning.
- **Actionable fixes** — concrete, image-aware suggestions for improving the
  content, plus what's working and what's holding it back.
- **Segment insights** — a plain-language summary, standout reactions, and a
  breakdown of how each personality cluster responds.

## 🧠 How it works

```
  YouTube URL / Image
          │
          ▼
  1  · Generate a 1,000-persona population   (pure code, deterministic, no API cost)
          │
          ▼
  2 · Stratify into ~24 audience segments    (age × buying-mindset)
          │
          ▼
  3 · Score a representative of each segment  (multimodal LLM: image + persona prompt)
          │
          ▼
  4 · Extrapolate a weighted consensus        (segment size → whole-population estimate)
          │
          ▼
  5 · Forecast reach, matrix & recommendations
```

The clever part is **step 4**: only ~1 persona per segment actually hits the
model, but each one is weighted by how many of the 1,000 it represents — so the
consensus honestly speaks for the full population while keeping cost and latency
low.

## 🎯 What makes it different

- **A whole audience, not one opinion.** Most AI feedback tools give you a
  single generic critique. PersonaVerse gives you a *distribution* — you can see
  that skeptical 35–44 business owners trust it but won't click, while
  trend-driven students will share it instantly.
- **Predictive, not descriptive.** It doesn't just describe your image; it
  projects an outcome — reach over time and how many of 1,000 people act.
- **Cost-aware by design.** The 1,000 personas are generated algorithmically
  (zero API calls); only the segment representatives are sent to the model.
- **Provider-agnostic and resilient.** A pluggable LLM layer load-balances
  across providers with automatic fallback and a hard time budget, so a single
  rate limit never stalls a run.
- **Built to be understood.** The results aren't a wall of numbers — they're an
  interactive, animated story: a living persona graph, a filling population
  grid, and a growing reach curve.

## 🛠️ Built with

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) · React · TypeScript |
| Styling | Tailwind CSS · shadcn/ui |
| Auth | Clerk |
| Database | MongoDB Atlas (Mongoose) |
| AI | Google Gemini (multimodal) with an OpenRouter fallback |
| Validation | Zod |
| Visuals | Custom SVG — force-directed graph, radar, projection & waffle charts (no chart library) |

## 🚀 Running locally

```bash
npm install
cp .env.example .env.local   # add your keys
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). See
[`.env.example`](./.env.example) for the required environment variables.

---

<div align="center">
<sub>Built as a rapid MVP — an experiment in simulating audiences instead of guessing them.</sub>
</div>
