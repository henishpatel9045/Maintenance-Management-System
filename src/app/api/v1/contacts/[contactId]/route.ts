import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ContactService,
  ensureContractorsEnabled,
  updateContactSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const PATCH = withAuth<{ contactId: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateContactSchema, req);
  const updated = await ContactService.update(params.contactId, body, user.id);

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth<{ contactId: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const deleted = await ContactService.delete(params.contactId, user.id);
  return NextResponse.json({ success: true, data: deleted });
});
