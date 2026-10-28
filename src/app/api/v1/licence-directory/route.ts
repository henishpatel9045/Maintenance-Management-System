import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  DirectoryService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/licence-directory - licences.directory.view
export const GET = withAuth("licences.directory.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const licenceTypeId = url.searchParams.get("licenceTypeId") || undefined;
  const categoryId = url.searchParams.get("categoryId") || undefined;
  const licClass = url.searchParams.get("class") || undefined;
  const status = url.searchParams.get("status") || undefined;
  const expiringWithinDays = url.searchParams.get("expiringWithinDays")
    ? Number(url.searchParams.get("expiringWithinDays"))
    : undefined;
  const availability = url.searchParams.get("availability") || undefined;
  const validOn = url.searchParams.get("validOn") || undefined;
  const includePending = url.searchParams.get("includePending") === "true";
  const hasAll = url.searchParams.get("hasAll") || undefined;
  const hasAny = url.searchParams.get("hasAny") || undefined;
  const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20;

  const tierContext = getLicenceTierContext(user);

  const result = await DirectoryService.queryDirectory(
    {
      q,
      licenceTypeId,
      categoryId,
      class: licClass,
      status,
      expiringWithinDays,
      availability,
      validOn,
      includePending,
      hasAll,
      hasAny,
      page,
      limit,
    },
    tierContext
  );

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
});
