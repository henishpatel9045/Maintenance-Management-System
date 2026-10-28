import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { RequestStatus } from "@prisma/client";

export const runtime = "nodejs";

const createRequestSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000),
    categoryId: z.string().uuid(),
    areaId: z.string().uuid(),
  })
  .strict();

export const GET = withAuth("requests.create", async (_req, { user }) => {
  // Members see their own requests; Admin/Coordinator see all requests
  const isElevated = user.role === "ADMIN" || user.role === "COORDINATOR";

  const requests = await db.sevaRequest.findMany({
    where: isElevated ? {} : { requestedById: user.id },
    include: {
      category: { select: { id: true, name: true, color: true } },
      area: { select: { id: true, name: true } },
      requestedBy: { select: { id: true, name: true, email: true } },
      convertedSeva: { select: { id: true, code: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: requests });
});

export const POST = withAuth("requests.create", async (req, { user }) => {
  const body = await validateBody(createRequestSchema, req);

  const request = await db.sevaRequest.create({
    data: {
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      areaId: body.areaId,
      requestedById: user.id,
      status: RequestStatus.OPEN,
    },
    include: {
      category: true,
      area: true,
      requestedBy: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    entityType: "SEVA_REQUEST",
    entityId: request.id,
    userId: user.id,
    action: "CREATE_REQUEST",
    newValue: { title: request.title },
  });

  // Notify Admins & Coordinators of new request
  const managers = await db.user.findMany({
    where: {
      role: { name: { in: ["ADMIN", "COORDINATOR"] } },
      isActive: true,
    },
    select: { id: true },
  });

  if (managers.length > 0) {
    await db.notification.createMany({
      data: managers.map((m) => ({
        userId: m.id,
        type: "NEW_SEVA_REQUEST",
        title: `New Seva Request: ${request.title}`,
        body: `Submitted by ${user.name}`,
        entityType: "SEVA_REQUEST",
        entityId: request.id,
        linkUrl: "/requests",
      })),
    });
  }

  return NextResponse.json({ data: request }, { status: 201 });
});
