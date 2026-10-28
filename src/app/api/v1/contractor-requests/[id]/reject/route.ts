import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  RequestService,
  ensureContractorsEnabled,
  rejectContractorRequestSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.requests.review", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(rejectContractorRequestSchema, req);
  const result = await RequestService.reject(params.id, body, user);

  return NextResponse.json({ success: true, data: result });
});
