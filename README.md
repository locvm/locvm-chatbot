# locvm-chatbot

Minimal FAQ chatbot MVP built with Next.js (App Router), TypeScript, Prisma, and PostgreSQL.
This project uses simple HTTP request/response APIs only.
No AI, no embeddings, and no WebSockets.

## Plan Status

1. Define core FAQ Q&As and hardcode structured answers.  
   Status: done (FAQ dataset is in `src/data/faqs.ts`).
2. Build one API endpoint to return closest matching FAQ answer (simple matching; no AI).  
   Status: done (`POST /api/faq`).
3. Log each interaction (`userId`, question, matched FAQ, timestamp) to Postgres via Prisma.  
   Status: done (`InteractionLog` write in `/api/faq`).
4. Add `Did this help?` (`yes/no`) feedback per interaction.  
   Status: done (`POST /api/faq/feedback`).
5. Host on Vercel with HTTP functions only + auth + rate limiting.  
   Status: HTTP-only is done; auth/rate limiting are pending.
6. Test internally and review logs after 30-90 days.  
   Status: pending.

## Repo Structure

- `app/api/faq/route.ts`
  - Working FAQ endpoint.
  - Validates input, runs matcher, writes interaction log, returns answer payload.
- `app/api/faq/feedback/route.ts`
  - Working feedback endpoint.
  - Validates input and updates `wasHelpful` for an interaction.
- `src/lib/matchFaq.ts`
  - Simple matcher: normalize input, keyword scoring, substring boost, threshold.
- `src/data/faqs.ts`
  - Hardcoded FAQ entries and FAQ type.
- `src/lib/db.ts`
  - Serverless-safe Prisma singleton (`getDb()`).
- `prisma/schema.prisma`
  - `InteractionLog` model.

## Local Setup

Recommended Node.js: `20.x LTS`

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Environment (`.env`):

```env
DATABASE_URL="postgres://..."
# Optional: auto | accelerate (default: auto)
PRISMA_CONNECTION_MODE="auto"
```

Notes:
- Prisma client here is configured to use Prisma Accelerate-style connection handling.
- Connection mode behavior:
  - `auto` (default): use Prisma Accelerate when API key exists.
  - `accelerate`: force Prisma Accelerate (requires API key).
  - This generated Prisma client currently requires Accelerate transport for runtime DB access.

Optional DB UI:

```bash
npx prisma studio
```

## Vercel Setup

1. Import repo into Vercel.
2. Set `DATABASE_URL` in Project Settings -> Environment Variables.
3. Redeploy.

Notes:
- Serverless HTTP only.
- No WebSocket infrastructure required.

## API Contract

### `POST /api/faq`

Request:

```json
{
  "userId": "user_123",
  "question": "How do I reset my password?"
}
```

Success response (200):

```json
{
  "interactionId": "clx123...", 
  "answer": "Use the Forgot Password link on the sign-in page...",
  "matchedFaqId": "reset-password",
  "matchScore": 7,
  "status": "matched"
}
```

No-match response (200):

```json
{
  "interactionId": null,
  "answer": "Sorry, I could not find a matching FAQ answer. Please contact support for help.",
  "matchedFaqId": null,
  "matchScore": null,
  "status": "no_match"
}
```

`interactionId` can be `null` when FAQ logging is temporarily unavailable; in that case feedback updates cannot be tied to that response.

Validation error (400):

```json
{
  "error": "invalid_request"
}
```

### `POST /api/faq/feedback`

Request:

```json
{
  "interactionId": "clx123...",
  "helpful": true
}
```

Success response (200):

```json
{
  "ok": true,
  "interactionId": "clx123...",
  "helpful": true
}
```

Not found (404):

```json
{
  "error": "interaction_not_found"
}
```

Validation error (400):

```json
{
  "error": "invalid_request"
}
```

## Verification Performed

- `npm run build` passes.
- Live endpoint smoke tests reached the routes.
- In this sandbox environment, DB writes failed due DNS resolution (`ENOTFOUND db.prisma.io`), so successful write verification depends on reachable DB networking in your runtime environment.

## Frontend Widget Prototype (Current)

- A simple floating chatbot widget is available on `/`:
  - circular launcher in the bottom-right
  - open/close panel with chat history
  - message composer
  - typing indicator (animated three dots) before assistant replies
- Current behavior:
  - sends questions to `POST /api/faq` and renders real matched/no-match answers
  - uses guided no-match suggestions for unsupported prompts
  - saves `Did this help?` feedback with `POST /api/faq/feedback`
  - if FAQ API call fails, falls back to local prototype reply logic
  - launcher text is explicit for non-technical users: `Questions? Ask Us`

Local test:

```bash
npm run dev
```

Open `http://localhost:3000`, click `Questions? Ask Us`, and send a few messages.

QA checklist:

- `docs/chatbot-widget-qa-checklist.md`

## Next Steps

- Add auth to API endpoints.
- Add rate limiting to prevent abuse/overages.
- Add minimal admin reporting for `no_match` and low helpfulness trends.
- Run internal trial and review logs after 30-90 days.
