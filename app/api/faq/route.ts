import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { matchFaq } from "@/src/lib/matchFaq";
import { applyRateLimit, buildRateLimitHeaders } from "@/src/lib/rateLimit";

export const runtime = "nodejs";

const ALLOWED_ORIGIN = "http://localhost:3000";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type FaqRequestBody = {
  userId: string;
  question: string;
};

type FaqResponseBody = {
  interactionId: string | null;
  answer: string;
  links: { label: string; href: string }[];
  matchedFaqId: string | null;
  matchScore: number | null;
  status: "matched" | "no_match";
  logSaved: boolean;
  logError: string | null;
};

const MAX_WRITE_ATTEMPTS = 2;
const DEFAULT_RATE_LIMIT_MAX = 25;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const FAQ_RATE_LIMIT_RULE = {
  keyPrefix: "faq",
  maxRequests: toPositiveInt(process.env.FAQ_RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
  windowMs: toPositiveInt(process.env.FAQ_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
};

function isValidFaqRequestBody(input: unknown): input is FaqRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<FaqRequestBody>;
  return typeof candidate.userId === "string" && typeof candidate.question === "string";
}

function isTransientDbError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = `${error.name} ${error.message}`.toLowerCase();
  return (
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("eai_again") ||
    text.includes("enotfound") ||
    text.includes("p1001") ||
    text.includes("fetch failed") ||
    text.includes("socket hang up")
  );
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createInteractionWithRetry(data: {
  userId: string;
  question: string;
  matchedFaqId: string | null;
  matchScore: number | null;
}): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const interaction = await getDb().interactionLog.create({ data });
      return interaction.id;
    } catch (error) {
      lastError = error;

      if (!isTransientDbError(error) || attempt === MAX_WRITE_ATTEMPTS) {
        throw error;
      }

      await wait(120 * attempt);
    }
  }

  throw lastError;
}

function withCorsHeaders(headers?: HeadersInit): Headers {
  const responseHeaders = new Headers(CORS_HEADERS);

  if (headers) {
    new Headers(headers).forEach((value, key) => {
      responseHeaders.set(key, value);
    });
  }

  return responseHeaders;
}

function jsonWithCors(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, {
    ...init,
    headers: withCorsHeaders(init?.headers),
  });
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

export async function OPTIONS(_req: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: withCorsHeaders(),
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimit = applyRateLimit(req, FAQ_RATE_LIMIT_RULE);
  if (!rateLimit.allowed) {
    return jsonWithCors(
      { error: "rate_limited", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  try {
    const body: unknown = await req.json();

    if (!isValidFaqRequestBody(body)) {
      return jsonWithCors({ error: "invalid_request" }, { status: 400 });
    }

    const userId = body.userId.trim();
    const question = body.question.trim();

    if (!userId || !question || userId.length > 128 || question.length > 2000) {
      return jsonWithCors({ error: "invalid_request" }, { status: 400 });
    }

    const result = matchFaq(question);

    let interactionId: string | null = null;
    let logSaved = false;
    let logError: string | null = null;
    try {
      interactionId = await createInteractionWithRetry({
        userId,
        question,
        matchedFaqId: result.matchedFaqId,
        matchScore: result.matchScore,
      });
      logSaved = true;
    } catch (error) {
      // Return FAQ response even when DB logging is unavailable.
      logError = "db_write_failed";
      console.error("faq_log_write_failed", error);
    }

    const responseBody: FaqResponseBody = {
      interactionId,
      answer: result.answer,
      links: result.links,
      matchedFaqId: result.matchedFaqId,
      matchScore: result.matchScore,
      status: result.status,
      logSaved,
      logError,
    };

    return jsonWithCors(
      responseBody,
      { status: 200 }
    );
  } catch {
    return jsonWithCors({ error: "internal_error" }, { status: 500 });
  }
}
