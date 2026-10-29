import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import {
  LicenceService,
  ensureLicencesEnabled,
  adminUpdateLicenceSchema,
  getLicenceTierContext,
  sanitizeUserLicence,
} from "@/modules/licences";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

// GET /api/v1/licences/:id
export const GET = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const licence = await db.userLicence.findUnique({
    where: { id },
    include: {
      licenceType: { include: { category: true } },
      user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
    },
  });

  if (!licence || licence.archivedAt != null) {
    throw new AppError(404, "NOT_FOUND", "Licence not found");
  }

  const isCoordinatorOrAdmin = user.role === "ADMIN" || user.role === "COORDINATOR";
  const tierContext = getLicenceTierContext(user);
  const isOwn = licence.userId === user.id;

  if (!isOwn && !isCoordinatorOrAdmin && !tierContext.canDirectoryView && !tierContext.canManage && !tierContext.canVerify) {
    throw new AppError(403, "FORBIDDEN", "Access denied");
  }

  const canSeeFull = isCoordinatorOrAdmin || tierContext.canManage || tierContext.canSensitiveView;
  const sanitized = canSeeFull
    ? { ...licence, isOwn, isMasked: false, licenceNumberMasked: licence.licenceNumber }
    : sanitizeUserLicence(licence, tierContext);

  return NextResponse.json(
    { data: sanitized },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// PATCH /api/v1/licences/:id (licences.manage or Coordinator/Admin)
export const PATCH = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const isCoordinatorOrAdmin = user.role === "ADMIN" || user.role === "COORDINATOR";
  if (!isCoordinatorOrAdmin && !can(user, "licences.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }

  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const body = await validateBody(adminUpdateLicenceSchema, req);
  const updated = await LicenceService.adminUpdateLicence(user.id, id, body);

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// DELETE /api/v1/licences/:id - Soft archive
export const DELETE = withAuth<{ id: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const isCoordinatorOrAdmin = user.role === "ADMIN" || user.role === "COORDINATOR";
  if (!isCoordinatorOrAdmin && !can(user, "licences.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }

  const id = params.id;
  if (!id) throw new AppError(400, "INVALID_ID", "Licence ID is required");

  const archived = await LicenceService.archiveLicence(user.id, id);

  return NextResponse.json(
    { data: archived, message: "Licence archived" },
    { headers: { "Cache-Control": "no-store" } }
  );
});
