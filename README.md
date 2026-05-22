# AI Coach

An AI-powered essay coaching platform for Ontario curriculum students (Grades 5–8). Teachers or parents assign essay topics; students write and submit; the AI evaluates the essay and returns structured, grade-appropriate feedback.

🌐 **Live demo:** [https://aicoach-delta.vercel.app/](https://aicoach-delta.vercel.app/)

---

## About This Project

> **This project is a proof of concept for AI-assisted software development.**
>
> The owner wrote **zero lines of code**. Every line of application code, database schema, API logic, prompt configuration, and deployment setup was written entirely by **[Claude Code](https://claude.ai/code)** (Anthropic's AI coding agent) through natural language conversations.
>
> The goal was to explore how far an AI coding agent can take a real-world product — from blank canvas to a deployed, working application — with a non-developer acting purely as the product owner: defining requirements, reviewing output, and steering decisions.

---

## Features

- **Topic generation** — AI generates age-appropriate essay topics based on the student's grade and Ontario curriculum guidelines
- **Essay evaluation** — Submited essays are scored and evaluated against grade-level rubrics; feedback is tiered by priority (structure first, then development, then polish)
- **Writing coach help** — Students can ask the coach for hints or guidance mid-essay without receiving a direct answer
- **Grade profiles** — Evaluation rules are fully config-driven via JSON grade profiles (G5 and G7 currently); no code changes needed to update rubrics
- **Dual AI provider** — Supports both Claude Sonnet (Anthropic) and GPT-4.1-mini (OpenAI); the active provider is switchable at runtime via a database setting — no redeployment required
- **Score caps** — Structural violations (missing intro, missing conclusion, insufficient body) automatically cap the total score to enforce writing fundamentals
- **41 automated tests** — Full test coverage on evaluation logic, scoring, and API endpoints

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI Providers | Anthropic Claude Sonnet + OpenAI GPT-4.1-mini |
| Database | PostgreSQL + Prisma ORM |
| Deploy | Vercel |
| Container | Docker (optional, for local Postgres) |

---

## Local Development

### Prerequisites
- Node.js 18+
- A PostgreSQL database **or** Docker (for local Postgres)
- An OpenAI API key and/or an Anthropic API key

### Setup

```bash
# 1. Clone
git clone https://github.com/LesterYKTam/aicoach.git
cd aicoach

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.local.example .env.local
# Fill in your database URL and AI provider keys
```

**.env.local:**
```
DATABASE_URL="postgresql://user:pass@host/dbname"

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

**Option B — local Docker Postgres:**
```bash
docker compose up -d   # starts Postgres on localhost:5432
```

```bash
# 4. Run migrations
npx prisma migrate dev

# 5. Set the active AI provider (run once after migration)
# Insert a SystemSetting row via Prisma Studio or SQL:
# INSERT INTO "SystemSetting" (key, value) VALUES ('aiProvider', 'anthropic');
# Options: 'anthropic' or 'openai'

npx prisma studio   # open DB browser to insert the row

# 6. Start the dev server
npm run dev   # http://localhost:3000
```

---

## Switching AI Providers

The active AI provider is stored in the database and cached for 60 seconds. To switch at runtime without redeploying:

```sql
-- Switch to Anthropic (Claude)
UPDATE "SystemSetting" SET value = 'anthropic' WHERE key = 'aiProvider';

-- Switch to OpenAI (GPT)
UPDATE "SystemSetting" SET value = 'openai' WHERE key = 'aiProvider';
```

Each AI call logs `[AI] provider=X model=Y` to the console for verification.

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm test` | Run all tests (41 tests) |
| `npx prisma studio` | Open DB browser |
| `npx prisma migrate dev` | Run migrations |

---

## Deploy

Push to `main` — Vercel auto-deploys.

```bash
git push origin main
```

**Required Vercel environment variables:**
- `DATABASE_URL`
- `OPENAI_API_KEY` and `OPENAI_MODEL`
- `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL`

---

## Project Structure

```
app/                          Next.js App Router pages + API routes
components/                   Shared UI components
grade_profile/
├── profile_g5_canada_ontario_2026.json   G5 rubric + evaluation rules
└── profile_g7_canada_ontario_2026.json   G7 rubric + evaluation rules
lib/
├── ai-provider.ts            Unified AI interface + provider switching
├── anthropic.ts              Anthropic client singleton
└── openai.ts                 OpenAI client singleton
prisma/
├── schema.prisma             Database schema
└── migrations/               Migration history
prompts/                      Legacy prompt templates
types/                        Shared TypeScript types
```
