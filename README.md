# locvm-chatbot

A minimal FAQ chatbot MVP built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL. Designed for serverless deployment on Vercel.

> **Note:** Business logic, FAQ matching, and full API responses are intentionally not implemented yet. This repository contains only the project scaffold, configuration, and placeholders for the next development phase.

---

## Project Purpose

Provide a structured starting point for a FAQ chatbot that:
- Accepts user questions via HTTP API endpoints
- Logs interactions to a PostgreSQL database via Prisma
- Returns matched FAQ answers (matching logic to be implemented)
- Records user feedback on answer helpfulness

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL (online instance)
- **Deployment:** Vercel (serverless HTTP only, no WebSockets)

---

## Setup Steps

### 1. Clone the repository

```bash
git clone https://github.com/locvm/locvm-chatbot.git
cd locvm-chatbot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set your PostgreSQL connection string:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

### 4. Generate the Prisma client

```bash
npx prisma generate
```

### 5. Run database migrations

```bash
npx prisma migrate dev --name init
```

### 6. Start the development server

```bash
npm run dev
```

---

## Vercel Deployment

1. Push the repository to GitHub.
2. Import the project in the [Vercel dashboard](https://vercel.com/new).
3. Add `DATABASE_URL` as an environment variable in the Vercel project settings.
4. Deploy – Vercel will automatically build and serve the Next.js app as serverless functions.

---

## Project Structure

```
/app
  /api
    /faq
      route.ts          ← FAQ query endpoint (TODO)
    /faq/feedback
      route.ts          ← Feedback recording endpoint (TODO)
  layout.tsx
  page.tsx

/src
  /data
    faqs.ts             ← FAQ data array and FAQ type definition
  /lib
    db.ts               ← PrismaClient singleton
    matchFaq.ts         ← FAQ matching logic (TODO)

/prisma
  schema.prisma         ← Database schema (InteractionLog model)
```

---

## TODO Markers

The following items are clearly marked `TODO` in the codebase and are scheduled for the next phase:

- `app/api/faq/route.ts` – implement question matching and response
- `app/api/faq/feedback/route.ts` – implement feedback recording
- `src/lib/matchFaq.ts` – implement matching algorithm
- `src/data/faqs.ts` – populate with real FAQ entries
