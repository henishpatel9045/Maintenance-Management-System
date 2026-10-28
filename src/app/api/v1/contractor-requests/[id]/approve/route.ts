import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  RequestService,
  ensureContractorsEnabled,
  approveContractorRequestSchema,
  ApproveContractorRequestInput,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.requests.review", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(approveContractorRequestSchema, req)) as ApproveContractorRequestInput;
  const result = await RequestService.approve(params.id, body, user);

  return NextResponse.json({ success: true, data: result });
});
