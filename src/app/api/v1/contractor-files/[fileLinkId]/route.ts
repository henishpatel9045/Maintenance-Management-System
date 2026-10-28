import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

const updateFileLinkSchema = z.object({
  label: z.string().trim().max(150).optional().nullable(),
  kind: z.enum(["CREDENTIAL", "INSURANCE", "CONTRACT", "INVOICE", "QUOTE", "ID", "OTHER"]).optional(),
  expiresAt: z.string().optional().nullable(),
}).strict();

export const PATCH = withAuth<{ fileLinkId: string }>("contractors.documents.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateFileLinkSchema, req);
  const updated = await ContractorStorageService.updateFileLink(
    params.fileLinkId,
    {
      label: body.label,
      kind: body.kind,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
    user.id
  );

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth<{ fileLinkId: string }>("contractors.documents.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const deleted = await ContractorStorageService.deleteFileLink(params.fileLinkId, user.id);
  return NextResponse.json({ success: true, data: deleted });
});
