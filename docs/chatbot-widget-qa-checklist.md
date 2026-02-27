# Chatbot Widget QA Checklist

Use this checklist during internal testing before release.

## Setup

1. Run `npm run dev`.
2. Open `http://localhost:3000`.
3. Open browser devtools and keep the Network tab visible.

## UI and Accessibility Checks

- [ ] Launcher is visible in bottom-right and reads `Questions? Ask Us`.
- [ ] Launcher icon is visible and button is easy to understand for non-technical users.
- [ ] Widget opens and closes from launcher and close button.
- [ ] Header follow-up link is visible and opens `mailto:support@locvm.ca`.
- [ ] Keyboard flow works: focus input, type, send with Enter.
- [ ] On mobile width, launcher and widget remain fully visible.

## Prompt Regression Checks

- [ ] `How do I reset my password?` returns the reset-password answer.
- [ ] `how do I reset my passwod` (typo) still returns a reset-password answer.
- [ ] `Are there platform fees?` returns pricing/fees guidance.
- [ ] `When do locum physicians get paid?` returns payment timing answer.
- [ ] `How can I contact support?` returns support/contact answer.
- [ ] `I want a locum in Toronto` returns guidance to use search page/list/map.
- [ ] `hello` returns a friendly greeting.
- [ ] `This is not working` or `you are wrong` returns human-support handoff (`support@locvm.ca`).
- [ ] A clearly unrelated prompt (example: `What is the weather in Paris?`) returns guided no-match suggestions.

## Feedback Flow Checks

- [ ] After a matched answer, `Did this help?` buttons appear.
- [ ] Clicking `Yes` shows confirmation text and disables both buttons.
- [ ] Clicking `No` shows confirmation text and disables both buttons.
- [ ] If feedback request fails, error text appears.

## API/Logging Checks

- [ ] `POST /api/faq` returns HTTP 200 for normal prompts.
- [ ] Rapid burst calls to `/api/faq` eventually return HTTP 429 with `error: rate_limited`.
- [ ] If DB logging fails, `/api/faq` still returns answer data (no 500).
- [ ] `POST /api/faq/feedback` returns HTTP 200 when `interactionId` is present.
- [ ] Rapid burst calls to `/api/faq/feedback` eventually return HTTP 429 with `error: rate_limited`.
- [ ] If `interactionId` is missing due to log failure, feedback controls are not shown for that reply.

## Release Sign-off

- [ ] `npm run build` passes.
- [ ] README matches current widget behavior and API contract.
- [ ] At least one complete test pass is recorded in team notes.
