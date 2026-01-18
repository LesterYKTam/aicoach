# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Writing Coach - an educational app that improves K-8 students' essay writing through AI-powered feedback. The system generates grade-appropriate essay topics, evaluates student submissions, and provides dual-audience feedback (encouraging for students, honest for parents).

## Repository Structure

```
aicoach/
├── ai-coach-api/     # AWS SAM serverless backend (Node.js Lambda functions)
├── ai-coach-ui/      # React + TypeScript frontend (Vite)
├── UI/               # Static HTML prototypes
└── Architecture Notes_1.0.txt  # Product requirements and architecture decisions
```

## Commands

### Backend (ai-coach-api/)

```bash
cd ai-coach-api

# Install dependencies
npm install

# Run tests (Jest with ES modules)
npm test

# Build SAM application
sam build

# Run API locally (requires Docker)
sam local start-api

# Deploy to AWS
sam deploy

# View logs
sam logs -n <FunctionName> --stack-name ai-coach-dev --tail

# Delete stack
sam delete --stack-name ai-coach-dev
```

### Frontend (ai-coach-ui/)

```bash
cd ai-coach-ui

# Install dependencies
npm install

# Run dev server
npm run dev

# Type check and build
npm run build

# Lint
npm run lint
```

## Architecture

### Backend
- **Runtime**: Node.js 22 on AWS Lambda
- **Infrastructure**: AWS SAM (template.yaml defines all resources)
- **Database**: DynamoDB with three tables:
  - `AiCoachProfiles` - Student profiles (deviceId + profileId)
  - `AiCoachSessions` - Writing sessions (GSI by profileId)
  - `AiCoachSubmissions` - Essay submissions (GSI by sessionId)
- **AI Provider**: OpenAI (gpt-4.1-mini) via structured JSON output
- **Secrets**: OpenAI API key stored in AWS SSM Parameter Store at `/ai-coach/openai_api_key`

### API Endpoints
- `POST /student/profile/create` - Create student profile
- `GET /student/profile/list` - List profiles by deviceId
- `POST /session/create` - Create writing session
- `GET /session/list` - List sessions by profileId
- `POST /topic/generate` - Generate essay topic with structure guidance
- `POST /submission/create` - Save essay submission
- `GET /submission/list` - List submissions by sessionId
- `POST /submission/evaluate` - AI-powered essay evaluation

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite (using rolldown-vite)
- **API Base**: Configurable via `VITE_API_BASE` env var, defaults to deployed AWS endpoint

### Key Design Patterns
- Lambda handlers use cached OpenAI client (cold start optimization)
- OpenAI calls use JSON Schema for structured output (see `evaluationSchema` in evaluateSubmission.js)
- Topic generation produces 4-paragraph essay structure (Intro, Body 1, Body 2, Conclusion)
- Evaluation uses 100-point rubric: Ideas (25), Organization (25), Voice (25), Conventions (25)
- All handlers include CORS headers for cross-origin requests

## Configuration Files
- `ai-coach-api/samconfig.toml` - SAM deployment config (stack name, region)
- `ai-coach-api/env.json` - Local Lambda environment variables
- `ai-coach-ui/.env` - Frontend environment (VITE_API_BASE)
