import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  CredentialService,
  ensureContractorsEnabled,
  updateCredentialSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const PATCH = withAuth<{ credentialId: string }>("contractors.credentials.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateCredentialSchema, req);
  const updated = await CredentialService.update(params.credentialId, body, user.id);

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth<{ credentialId: string }>("contractors.credentials.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const revoked = await CredentialService.delete(params.credentialId, user.id);
  return NextResponse.json({ success: true, data: revoked });
});
