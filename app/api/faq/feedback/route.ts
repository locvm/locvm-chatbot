import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { applyRateLimit, buildRateLimitHeaders } from "@/src/lib/rateLimit";

export const runtime = "nodejs";

type FeedbackRequestBody = {
  interactionId?: string;
  helpful: boolean;
  fallbackLog?: {
    userId?: string;
    question?: string;
    matchedFaqId?: string | null;
    matchScore?: number | null;
  };
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
  if (typeof candidate.helpful !== "boolean") {
    return false;
  }

  if (
    candidate.interactionId !== undefined &&
    typeof candidate.interactionId !== "string"
  ) {
    return false;
  }

  if (candidate.fallbackLog !== undefined) {
    if (!candidate.fallbackLog || typeof candidate.fallbackLog !== "object") {
      return false;
    }

    const fallbackLog = candidate.fallbackLog as Partial<
      NonNullable<FeedbackRequestBody["fallbackLog"]>
    >;
    if (
      fallbackLog.userId !== undefined &&
      typeof fallbackLog.userId !== "string"
    ) {
      return false;
    }

    if (
      fallbackLog.question !== undefined &&
      typeof fallbackLog.question !== "string"
    ) {
      return false;
    }

    if (
      fallbackLog.matchedFaqId !== undefined &&
      fallbackLog.matchedFaqId !== null &&
      typeof fallbackLog.matchedFaqId !== "string"
    ) {
      return false;
    }

    if (
      fallbackLog.matchScore !== undefined &&
      fallbackLog.matchScore !== null &&
      typeof fallbackLog.matchScore !== "number"
    ) {
      return false;
    }
  }

  return true;
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

async function createFeedbackInteractionWithRetry(data: {
  userId: string;
  question: string;
  matchedFaqId: string | null;
  matchScore: number | null;
  wasHelpful: boolean;
}): Promise<string> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt += 1) {
    try {
      const created = await getDb().interactionLog.create({ data });
      return created.id;
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

    const interactionId =
      typeof body.interactionId === "string" ? body.interactionId.trim() : "";
    const fallbackUserId = body.fallbackLog?.userId?.trim() ?? "";
    const fallbackQuestion = body.fallbackLog?.question?.trim() ?? "";
    const fallbackMatchedFaqId = body.fallbackLog?.matchedFaqId ?? null;
    const fallbackMatchScore = body.fallbackLog?.matchScore ?? null;
    const hasValidFallbackLog =
      fallbackUserId.length > 0 &&
      fallbackQuestion.length > 0 &&
      fallbackUserId.length <= 128 &&
      fallbackQuestion.length <= 2000 &&
      (fallbackMatchedFaqId === null ||
        (typeof fallbackMatchedFaqId === "string" && fallbackMatchedFaqId.length <= 128)) &&
      (fallbackMatchScore === null || Number.isFinite(fallbackMatchScore));

    if (!interactionId && !hasValidFallbackLog) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    if (interactionId && interactionId.length > 128) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    let resolvedInteractionId = interactionId;
    let resolutionMode: "updated_existing" | "created_from_feedback" = "updated_existing";

    if (interactionId) {
      const updatedCount = await updateFeedbackWithRetry(interactionId, body.helpful);
      if (updatedCount === 0) {
        if (!hasValidFallbackLog) {
          return NextResponse.json({ error: "interaction_not_found" }, { status: 404 });
        }

        resolvedInteractionId = await createFeedbackInteractionWithRetry({
          userId: fallbackUserId,
          question: fallbackQuestion,
          matchedFaqId: fallbackMatchedFaqId,
          matchScore: fallbackMatchScore,
          wasHelpful: body.helpful,
        });
        resolutionMode = "created_from_feedback";
      }
    } else {
      resolvedInteractionId = await createFeedbackInteractionWithRetry({
        userId: fallbackUserId,
        question: fallbackQuestion,
        matchedFaqId: fallbackMatchedFaqId,
        matchScore: fallbackMatchScore,
        wasHelpful: body.helpful,
      });
      resolutionMode = "created_from_feedback";
    }

    return NextResponse.json(
      {
        ok: true,
        interactionId: resolvedInteractionId,
        helpful: body.helpful,
        resolutionMode,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
