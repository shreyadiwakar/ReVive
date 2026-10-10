# ReVive Architecture

## Overview

ReVive is a full-stack waste management and recycling platform built with:

- **Frontend**: Next.js (App Router) + TypeScript
- **Backend**: AWS Lambda (Node.js) + API Gateway
- **Database**: DynamoDB / PostgreSQL (TBD)
- **AI Service**: Python-based waste classifier (optional)

## High-Level Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Next.js App   │────▶│   API Gateway    │────▶│ Lambda Fns   │
│  (Frontend)     │     │                  │     │ (Backend)    │
└─────────────────┘     └──────────────────┘     └──────┬───────┘
                                                         │
                                              ┌──────────▼───────┐
                                              │    Database      │
                                              └──────────────────┘
```

## Directory Structure

```
ReVive/
├── src/               # Next.js frontend
│   ├── app/           # Pages and routes (App Router)
│   ├── components/    # Shared UI components
│   ├── features/      # Feature modules (waste, pickups, rewards, impact)
│   ├── lib/
│   │   ├── api/       # Frontend API client
│   │   ├── auth/      # Authentication helpers
│   │   └── utils/     # Shared utilities
│   └── types/         # Shared TypeScript types
├── backend/
│   ├── functions/     # Lambda handlers
│   ├── services/      # Business logic
│   ├── repositories/  # Database operations
│   ├── schemas/       # Input validation
│   └── tests/
├── ai-service/        # Optional Python waste classifier
└── docs/
```

## Feature Modules

- **waste** – Waste item logging and categorization
- **pickups** – Pickup scheduling and tracking
- **rewards** – Points and rewards system
- **impact** – Environmental impact metrics

_More details coming soon._
