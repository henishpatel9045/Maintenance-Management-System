import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  SevaContractorService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

const linkQuoteSchema = z
  .object({
    quoteFileId: z.string().uuid().optional(),
    sevaFileId: z.string().uuid().optional(),
    contractorId: z.string().uuid(),
  })
  .refine((data) => !!(data.quoteFileId || data.sevaFileId), {
    message: "quoteFileId or sevaFileId is required",
    path: ["quoteFileId"],
  });

export const POST = withAuth("contractors.manage", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(linkQuoteSchema, req);
  const targetFileId = (body.quoteFileId || body.sevaFileId)!;
  const updated = await SevaContractorService.linkQuoteToContractor(
    targetFileId,
    body.contractorId,
    user.id
  );

  return NextResponse.json({ success: true, data: updated });
});
