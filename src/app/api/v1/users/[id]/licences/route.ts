import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  LicenceService,
  ensureLicencesEnabled,
  adminCreateLicenceSchema,
  getLicenceTierContext,
  sanitizeUserLicence,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/users/:id/licences
export const GET = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const targetUserId = params.id;
  if (!targetUserId) throw new AppError(400, "INVALID_ID", "User ID is required");

  const tierContext = getLicenceTierContext(user);
  const isOwn = user.id === targetUserId;

  if (!isOwn && !tierContext.canDirectoryView && !tierContext.canManage && !tierContext.canVerify) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to view this user's licences");
  }

  const licences = await db.userLicence.findMany({
    where: {
      userId: targetUserId,
      archivedAt: null,
    },
    include: {
      licenceType: { include: { category: true } },
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
    },
    orderBy: [
      { supersededById: "asc" },
      { createdAt: "desc" },
    ],
  });

  const sanitized = licences.map((lic) => sanitizeUserLicence(lic, tierContext));

  return NextResponse.json(
    { data: sanitized },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// POST /api/v1/users/:id/licences - Add licence for user (licences.manage)
export const POST = withAuth<{ id: string }>("licences.manage", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const targetUserId = params.id;
  if (!targetUserId) throw new AppError(400, "INVALID_ID", "User ID is required");

  const body = await validateBody(adminCreateLicenceSchema.omit({ userId: true }), req);
  const created = await LicenceService.adminCreateLicence(user.id, {
    ...body,
    userId: targetUserId,
  });

  return NextResponse.json(
    { data: created },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
