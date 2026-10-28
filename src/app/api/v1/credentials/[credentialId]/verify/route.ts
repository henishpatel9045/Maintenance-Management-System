import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { CredentialService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ credentialId: string }>("contractors.credentials.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const verified = await CredentialService.verify(params.credentialId, user.id);
  return NextResponse.json({ success: true, data: verified });
});
