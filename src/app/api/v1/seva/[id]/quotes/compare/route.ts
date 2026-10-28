import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { compareQuotesForSeva } from "@/modules/files/quotes.service";

export const runtime = "nodejs";

export const GET = withAuth("quotes.view", async (_req, { params }) => {
  const { id } = params as { id: string };
  const comparison = await compareQuotesForSeva(id);
  return NextResponse.json({ data: comparison });
});
