import { NextRequest, NextResponse } from "next/server";

// TODO: Implement FAQ matching logic in next phase
export async function GET(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "FAQ endpoint – not yet implemented" }, { status: 501 });
}

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ message: "FAQ endpoint – not yet implemented" }, { status: 501 });
}
