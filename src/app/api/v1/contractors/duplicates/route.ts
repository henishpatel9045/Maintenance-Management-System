import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  ContractorService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.read", async (req) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || undefined;
  const registrationNumber = url.searchParams.get("registrationNumber") || undefined;
  const registrationType = url.searchParams.get("registrationType") || undefined;
  const excludeId = url.searchParams.get("excludeId") || undefined;

  const duplicates = await ContractorService.findDuplicates({
    name,
    registrationNumber,
    registrationType,
    excludeId,
  });

  return NextResponse.json({ data: duplicates });
});
