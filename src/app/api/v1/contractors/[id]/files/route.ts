import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.documents.view", async (req, { params }) => {
  await ensureContractorsEnabled();

  const files = await ContractorStorageService.listContractorFiles(params.id);
  return NextResponse.json({ data: files }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withAuth<{ id: string }>("contractors.documents.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const contractor = await db.contractor.findUnique({
    where: { id: params.id },
    select: { code: true },
  });

  if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new AppError(400, "MISSING_FILE", "File is required");

  const kind = (formData.get("kind") as any) || "OTHER";
  const label = (formData.get("label") as string) || null;
  const expiresAtStr = formData.get("expiresAt") as string | null;
  const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
  const credentialId = (formData.get("credentialId") as string) || null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileLink = await ContractorStorageService.uploadContractorDocument({
    buffer,
    originalName: file.name,
    contractorCode: contractor.code,
    kind,
    label,
    expiresAt,
    credentialId,
    uploadedById: user.id,
  });

  return NextResponse.json({ data: fileLink }, { status: 201 });
});
