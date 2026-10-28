import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  RequestService,
  ensureContractorsEnabled,
  requestMoreInfoSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ id: string }>("contractors.requests.review", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(requestMoreInfoSchema, req);
  const result = await RequestService.requestMoreInfo(params.id, body, user);

  return NextResponse.json({ success: true, data: result });
});
