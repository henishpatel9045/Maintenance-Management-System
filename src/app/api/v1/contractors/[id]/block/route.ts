import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { ContractorService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

const blockSchema = z.object({
  reason: z.string().trim().min(3, "Reason of at least 3 characters is required to block a contractor").max(1000),
}).strict();

export const POST = withAuth<{ id: string }>("contractors.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(blockSchema, req);
  const blocked = await ContractorService.block(params.id, body.reason, user.id);

  return NextResponse.json({ success: true, data: blocked });
});
