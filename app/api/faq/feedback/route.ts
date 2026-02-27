import { NextRequest, NextResponse } from "next/server";

// TODO: Implement feedback recording logic in next phase
export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { message: "FAQ feedback endpoint – not yet implemented" },
    { status: 501 }
  );
}
