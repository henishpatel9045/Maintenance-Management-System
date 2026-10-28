import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  SevaContractorService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.assign", async (req, { params }) => {
  await ensureContractorsEnabled();

  const suggestions = await SevaContractorService.getSuggestions(params.id);

  return NextResponse.json({ data: suggestions });
});
