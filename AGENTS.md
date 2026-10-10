# ReVive — Agent Instructions

## Project Overview

ReVive is a full-stack waste management and recycling platform. The goal is to make recycling easy, rewarding, and impactful.

## Repository Structure

```
ReVive/
├── src/               # Next.js 14 frontend (App Router, TypeScript)
│   ├── app/           # Pages and routes
│   ├── components/    # Shared UI components
│   ├── features/      # Feature modules: waste, pickups, rewards, impact
│   ├── lib/
│   │   ├── api/       # Frontend API client (fetch wrappers)
│   │   ├── auth/      # Auth helpers (NextAuth / JWT)
│   │   └── utils/     # Shared utilities (formatting, validation)
│   └── types/         # Shared TypeScript interfaces and types
├── backend/           # AWS Lambda backend (Node.js / TypeScript)
│   ├── functions/     # Lambda handler entry points
│   ├── services/      # Business logic layer
│   ├── repositories/  # Database access layer
│   ├── schemas/       # Zod/Joi input validation schemas
│   └── tests/         # Backend unit and integration tests
├── ai-service/        # Optional Python waste image classifier
└── docs/              # Project documentation
```

## Coding Conventions

- **Language**: TypeScript (strict mode) for all frontend and backend code
- **Styling**: Vanilla CSS / CSS Modules — no Tailwind unless explicitly requested
- **API**: RESTful, versioned under `/v1`
- **Validation**: Zod for all input schemas
- **Testing**: Jest for unit tests, Playwright for e2e

## Key Features

1. **Waste Logging** — Users log recyclable items with category and weight
2. **Pickup Scheduling** — Schedule doorstep pickups
3. **Rewards** — Earn points redeemable for discounts/vouchers
4. **Impact Dashboard** — Visualize environmental impact metrics

## Important Notes for Agents

- Always keep `src/types/` in sync when adding new data models
- Backend handlers in `backend/functions/` must be thin — delegate logic to `services/`
- Never commit real secrets — use `.env.example` as reference
