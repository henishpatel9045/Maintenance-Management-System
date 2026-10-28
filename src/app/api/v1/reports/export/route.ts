import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { computeKpis } from "@/modules/dashboard/kpi";
import { can } from "@/core/permissions/can";
import { exportToPdf } from "@/core/export/pdf";
import { exportToExcel } from "@/core/export/excel";
import { exportToCsv } from "@/core/export/csv";
import { ExportTableSpec, ColumnSpec } from "@/core/export/types";
import { logAudit } from "@/core/audit/audit";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

const reportExportSchema = z.object({
  format: z.enum(["pdf", "xlsx", "csv"]),
  from: z.string().optional(),
  to: z.string().optional(),
  rootSevaId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  areaId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  kind: z.string().optional(),
}).strict();

export const POST = withAuth("reports.view", async (req, { user }) => {
  const body = await validateBody(reportExportSchema, req);
  const canViewQuotes = can(user, "quotes.view");
  const orgName = (user.settings?.["orgName"] as string) || "Seva Maintenance Management";

  const { metrics } = await computeKpis(body);

  // Detail occurrences
  let allowedSevaIds: string[] | null = null;
  if (body.rootSevaId) {
    const root = await db.seva.findUnique({ where: { id: body.rootSevaId }, select: { path: true } });
    if (root) {
      const subtree = await db.seva.findMany({
        where: { path: { startsWith: root.path } },
        select: { id: true },
      });
      allowedSevaIds = subtree.map((s) => s.id);
    }
  }

  const where: Prisma.OccurrenceWhereInput = {
    seva: {
      isArchived: false,
      ...(allowedSevaIds ? { id: { in: allowedSevaIds } } : {}),
      ...(body.categoryId ? { categoryId: body.categoryId } : {}),
      ...(body.areaId ? { areaId: body.areaId } : {}),
      ...(body.assigneeId ? { assignees: { some: { userId: body.assigneeId } } } : {}),
      ...(body.kind ? { kind: body.kind as any } : {}),
    },
    ...(body.from || body.to
      ? {
          dueDate: {
            ...(body.from ? { gte: new Date(body.from) } : {}),
            ...(body.to ? { lte: new Date(body.to) } : {}),
          },
        }
      : {}),
  };

  const occurrences = await db.occurrence.findMany({
    where,
    include: {
      seva: {
        include: {
          category: { select: { name: true } },
          area: { select: { name: true } },
          assignees: { include: { user: { select: { name: true } } } },
        },
      },
      completedBy: { select: { name: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  const columns: ColumnSpec[] = [
    { header: "Code", key: "code", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Category", key: "category", width: 18 },
    { header: "Area", key: "area", width: 20 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Status", key: "status", width: 16 },
    { header: "Assignees", key: "assignees", width: 25 },
    { header: "Completed Date", key: "completedAt", width: 16 },
  ];

  if (canViewQuotes) {
    columns.push({ header: "Actual Cost", key: "actualCost", width: 14 });
  }

  const data = occurrences.map((occ) => ({
    code: occ.seva.code,
    title: occ.seva.title,
    category: occ.seva.category.name,
    area: occ.seva.area.name,
    dueDate: format(new Date(occ.dueDate), "yyyy-MM-dd"),
    status: occ.status,
    assignees: occ.seva.assignees.map((a) => a.user.name).join(", "),
    completedAt: occ.completedAt ? format(new Date(occ.completedAt), "yyyy-MM-dd") : "-",
    actualCost: occ.actualCost ? Number(occ.actualCost) : "-",
  }));

  const spec: ExportTableSpec = {
    title: "Seva Maintenance Report",
    orgName,
    dateRange: body.from && body.to ? { from: body.from, to: body.to } : undefined,
    generatedBy: user.name,
    generatedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    columns,
    data,
    summary: {
      "Total Seva Jobs": metrics.total,
      "Completed": metrics.done,
      "Completion Rate": `${metrics.completionPercent}%`,
      "On-Time Rate": `${metrics.onTimePercent}%`,
      "Overdue": metrics.overdue,
      ...(canViewQuotes ? { "Total Spend": `$${metrics.totalSpend}` } : {}),
    },
  };

  await logAudit({
    entityType: "REPORT",
    entityId: "export",
    userId: user.id,
    action: `EXPORT_${body.format.toUpperCase()}`,
    newValue: { format: body.format, rowCount: data.length },
  });

  if (body.format === "csv") {
    const csvContent = exportToCsv(spec);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="seva-report.csv"',
      },
    });
  }

  if (body.format === "xlsx") {
    const excelBuffer = await exportToExcel(spec);
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="seva-report.xlsx"',
      },
    });
  }

  // PDF
  const pdfBuffer = await exportToPdf(spec);
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="seva-report.pdf"',
    },
  });
});
