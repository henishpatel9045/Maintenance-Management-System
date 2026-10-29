import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

import { AppError } from "@/core/http/error";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

export const GET = withAuth({}, async (_req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR" && !can(user, "users.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }
  const roles = await db.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: {
        select: { permissionKey: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    data: roles.map((r) => ({
      ...r,
      permissions: r.permissions.map((p) => p.permissionKey),
    })),
  });
});
