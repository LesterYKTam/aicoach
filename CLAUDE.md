# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Writing Coach - an educational app that improves K-8 students' essay writing through AI-powered feedback. The system generates grade-appropriate essay topics, evaluates student submissions, and provides dual-audience feedback (encouraging for students, honest for parents).

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Database**: PostgreSQL (Neon for production, local Postgres for dev)
- **ORM**: Prisma
- **AI**: OpenAI (gpt-4.1-mini)
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Docker (AWS App Runner or Azure Container Apps)

## Repository Structure

```
aicoach/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx            # Main writing coach UI
│   ├── globals.css
│   └── api/                # API routes
│       ├── student/profile/{create,list}/
│       ├── session/{create,list}/
│       ├── topic/generate/
│       └── submission/{create,list,evaluate}/
├── components/ui/          # shadcn/ui components
├── lib/
│   ├── db.ts               # Prisma client
│   ├── openai.ts           # OpenAI client
│   └── utils.ts            # Utilities
├── prisma/
│   └── schema.prisma       # Database schema
├── rubric/                 # Grading rubrics (JSON)
│   └── rubric_canada_ontrio_2026.json
├── Dockerfile
├── docker-compose.yml      # Local dev with Postgres
└── package.json
```

## Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Database
npx prisma migrate dev    # Apply migrations
npx prisma db push        # Push schema (no migration)
npx prisma studio         # DB browser
npx prisma generate       # Generate client

# Build
npm run build

# Lint
npm run lint

# Docker (local full stack)
docker-compose up         # Start app + Postgres
docker-compose up -d      # Detached mode
docker-compose down       # Stop
```

## Database Schema

```prisma
model Profile {
  id          String    @id @default(uuid())
  deviceId    String
  displayName String?
  grade       Int?
  sessions    Session[]
  @@index([deviceId])
}

model Session {
  id          String       @id @default(uuid())
  profileId   String
  topic       String?
  status      String       @default("active")
  submissions Submission[]
  @@index([profileId, createdAt])
}

model Submission {
  id         String   @id @default(uuid())
  sessionId  String
  essayText  String
  evaluation Json?
  @@index([sessionId, createdAt])
}
```

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| /api/student/profile/create | POST | Create student profile |
| /api/student/profile/list | GET | List profiles by deviceId |
| /api/session/create | POST | Create writing session |
| /api/session/list | GET | List sessions by profileId |
| /api/topic/generate | POST | Generate essay topic with AI |
| /api/submission/create | POST | Save essay submission |
| /api/submission/list | GET | List submissions by sessionId |
| /api/submission/evaluate | POST | AI-powered essay evaluation |

## Key Design Patterns

- Prisma client is cached globally to avoid connection exhaustion
- OpenAI client is cached globally for efficiency
- OpenAI calls use JSON Schema for structured output
- Topic generation produces 4-paragraph essay structure
- Evaluation uses Ontario curriculum rubric (100 points):
  - Knowledge & Understanding (20)
  - Thinking (20)
  - Communication & Structure (35)
  - Application (25)
- Rubric files stored in `rubric/` folder (JSON format)
- Structure requirements enforced: intro, 2+ body paragraphs, conclusion
- Score capped at 65 if structure incomplete; rewrite required if < 70

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."  # Neon or local Postgres
OPENAI_API_KEY="sk-..."

# Optional
OPENAI_MODEL="gpt-4.1-mini"      # Default model
```

## Archived Folders

The following folders contain the old Lambda + DynamoDB implementation and are kept for reference:
- `ai-coach-api/` - AWS SAM serverless backend
- `ai-coach-ui/` - Vite React frontend
- `UI/` - Static HTML prototypes
