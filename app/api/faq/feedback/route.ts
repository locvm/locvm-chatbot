import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { applyRateLimit, buildRateLimitHeaders } from "@/src/lib/rateLimit";

export const runtime = "nodejs";

type FeedbackRequestBody = {
  interactionId: string;
  helpful: boolean;
};

const MAX_WRITE_ATTEMPTS = 2;
const DEFAULT_RATE_LIMIT_MAX = 50;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

function toPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const FEEDBACK_RATE_LIMIT_RULE = {
  keyPrefix: "faq-feedback",
  maxRequests: toPositiveInt(
    process.env.FEEDBACK_RATE_LIMIT_MAX,
    DEFAULT_RATE_LIMIT_MAX
  ),
  windowMs: toPositiveInt(
    process.env.FEEDBACK_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_WINDOW_MS
  ),
};

function isValidFeedbackRequestBody(input: unknown): input is FeedbackRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<FeedbackRequestBody>;
  return typeof candidate.interactionId === "string" && typeof candidate.helpful === "boolean";
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

async function updateFeedbackWithRetry(interactionId: string, helpful: boolean): Promise<number> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const updateResult = await getDb().interactionLog.updateMany({
        where: { id: interactionId },
        data: { wasHelpful: helpful },
      });
      return updateResult.count;
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

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimit = applyRateLimit(req, FEEDBACK_RATE_LIMIT_RULE);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rateLimit.retryAfterSeconds },
      { status: 429, headers: buildRateLimitHeaders(rateLimit) }
    );
  }

  try {
    const body: unknown = await req.json();

    if (!isValidFeedbackRequestBody(body)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const interactionId = body.interactionId.trim();

    if (!interactionId || interactionId.length > 128) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const updatedCount = await updateFeedbackWithRetry(interactionId, body.helpful);
    if (updatedCount === 0) {
      return NextResponse.json({ error: "interaction_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        ok: true,
        interactionId,
        helpful: body.helpful,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
