import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/src/lib/db";

export const runtime = "nodejs";

type FeedbackRequestBody = {
  interactionId: string;
  helpful: boolean;
};

function isValidFeedbackRequestBody(input: unknown): input is FeedbackRequestBody {
  if (!input || typeof input !== "object") {
    return false;
  }

  const candidate = input as Partial<FeedbackRequestBody>;
  return typeof candidate.interactionId === "string" && typeof candidate.helpful === "boolean";
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await req.json();

    if (!isValidFeedbackRequestBody(body)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const interactionId = body.interactionId.trim();

    if (!interactionId || interactionId.length > 128) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }

    const updateResult = await getDb().interactionLog.updateMany({
      where: { id: interactionId },
      data: { wasHelpful: body.helpful },
    });

    if (updateResult.count === 0) {
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
