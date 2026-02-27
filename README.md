# locvm-chatbot

Minimal FAQ chatbot MVP scaffold built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL.
It is designed for simple request/response APIs and internal validation before expanding scope.
This repo is intentionally non-AI: no embeddings/LLM ranking and no real-time transport.
No WebSockets are used; only HTTP serverless functions.

## Mini Accepted Plan

1. Define 20-30 core FAQ Q&As and hardcode structured answers.
2. Build one API endpoint that receives a question and returns the closest matching FAQ answer (simple matching; no AI).
3. Log each interaction (`user_id`, question, matched FAQ, timestamp) to Postgres via Prisma.
4. Add `Did this help?` (`yes` / `no`) feedback per interaction.
5. Host on Vercel using HTTP serverless functions only (no WebSockets), with auth + rate limiting to reduce abuse/overages.
6. Test internally and review logs after 30-90 days to decide next improvements.

## Repo Structure

- `app/api/faq/route.ts`
  - Placeholder route handlers (`GET`, `POST`) currently return `501 Not Implemented`.
  - Intended to receive a question and return best FAQ match.
- `app/api/faq/feedback/route.ts`
  - Placeholder `POST` handler returns `501 Not Implemented`.
  - Intended to record helpfulness feedback tied to an interaction.
- `src/data/faqs.ts`
  - Defines `FAQ` type and exports `faqs` array (currently empty).
  - Intended source of 20-30 curated FAQ entries.
- `src/lib/db.ts`
  - Prisma singleton placeholder pattern for app-wide DB access.
  - Notes indicate Prisma adapter-based initialization is still TODO.

## Setup (Local)

Recommended Node.js: `20.x LTS`.

```bash
# 1) install dependencies
npm install

# 2) create local environment file
cat > .env <<'ENV'
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
ENV

# 3) generate Prisma client
npx prisma generate

# 4) run migrations
npx prisma migrate dev --name init

# 5) start dev server
npm run dev
```

Optional DB inspection:

```bash
npx prisma studio
```

## Setup (Vercel)

1. Create/import the project in Vercel.
2. Add `DATABASE_URL` in Project Settings -> Environment Variables.
3. Redeploy after setting the variable.

Notes:
- Deployment model is serverless HTTP functions only.
- No WebSocket infrastructure is required for this MVP.

## API Contract (Documentation Only)

Current status: route files are placeholders and return `501`; shapes below define the intended contract.

### `POST /api/faq`

Request JSON:

```json
{
  "user_id": "user_123",
  "question": "How do I reset my password?"
}
```

Success response JSON (200):

```json
{
  "interaction_id": "clx123...",
  "matched": true,
  "faq": {
    "id": "password_reset",
    "question": "How do I reset my password?",
    "answer": "Use the Forgot Password link on the sign-in page."
  },
  "match_score": 87
}
```

No-match response JSON (200):

```json
{
  "interaction_id": "clx124...",
  "matched": false,
  "faq": null,
  "match_score": 0
}
```

Validation error response JSON (400):

```json
{
  "error": "invalid_request"
}
```

### `POST /api/faq/feedback`

Request JSON:

```json
{
  "interaction_id": "clx123...",
  "helpful": true
}
```

Success response JSON (200):

```json
{
  "ok": true,
  "interaction_id": "clx123...",
  "helpful": true
}
```

Validation/not-found error examples:

```json
{
  "error": "invalid_request"
}
```

```json
{
  "error": "interaction_not_found"
}
```

## Guardrails / Considerations

- HTTP-only transport keeps deployment simpler and cheaper for FAQ-style request/response behavior.
- Auth + rate limiting are required to reduce abuse risk and control serverless/database spend.
- Data minimization: store only what is needed for quality review (`user_id`, question text, match metadata, feedback, timestamps).
- Do not log secrets or sensitive free-form payloads beyond the needed question string.
- Optional retention policy: keep logs for 90 days, then archive/delete.

## Next Steps (Implementation Checklist)

- [ ] Populate `src/data/faqs.ts` with 20-30 curated FAQ entries.
- [ ] Implement simple FAQ matcher (`src/lib/matchFaq.ts`).
- [ ] Implement `/api/faq` logging write via Prisma.
- [ ] Implement `/api/faq/feedback` helpfulness update.
- [ ] Add auth and rate limiting at API boundary.
- [ ] Add minimal admin script/page to review `no_match` and low-helpfulness interactions.
