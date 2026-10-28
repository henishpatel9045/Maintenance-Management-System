import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  SevaContractorService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

const linkQuoteSchema = z.object({
  quoteFileId: z.string().uuid(),
  contractorId: z.string().uuid(),
}).strict();

export const POST = withAuth("contractors.manage", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(linkQuoteSchema, req);
  const updated = await SevaContractorService.linkQuoteToContractor(
    body.quoteFileId,
    body.contractorId,
    user.id
  );

  return NextResponse.json({ success: true, data: updated });
});
