import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";
import { matchFaq } from "@/src/lib/matchFaq";

export const runtime = "nodejs";

type FaqRequestBody = {
  userId: string;
  question: string;
};

function isValidFaqRequestBody(input: unknown): input is FaqRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<FaqRequestBody>;
  return typeof candidate.userId === "string" && typeof candidate.question === "string";
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    if (!isValidFaqRequestBody(body)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const userId = body.userId.trim();
    const question = body.question.trim();

    if (!userId || !question || userId.length > 128 || question.length > 2000) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const result = matchFaq(question);

    await getDb().interactionLog.create({
      data: {
        userId,
        question,
        matchedFaqId: result.matchedFaqId,
        matchScore: result.matchScore,
      },
    });

    return NextResponse.json(
      {
        answer: result.answer,
        matchedFaqId: result.matchedFaqId,
        matchScore: result.matchScore,
        status: result.status,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
