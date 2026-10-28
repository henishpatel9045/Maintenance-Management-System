import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SevaContractorService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.manage", async () => {
  await ensureContractorsEnabled();

  const suggestions = await SevaContractorService.suggestQuoteMatches();
  return NextResponse.json({ data: suggestions });
});
