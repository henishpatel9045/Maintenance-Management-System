import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { computeKpis } from "@/modules/dashboard/kpi";
import { can, AuthenticatedUser } from "@/core/permissions/can";
import { exportToPdf } from "@/core/export/pdf";
import { exportToExcel } from "@/core/export/excel";
import { exportToCsv } from "@/core/export/csv";
import { ExportTableSpec, ColumnSpec } from "@/core/export/types";
import { logAudit } from "@/core/audit/audit";
import { format } from "date-fns";
import { Prisma } from "@prisma/client";
import { errorResponse } from "@/core/http/error";

export const runtime = "nodejs";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function toOptionalUuid(val: string | null | undefined): string | undefined {
  if (!val || typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return UUID_REGEX.test(trimmed) ? trimmed : undefined;
}

function isValidDate(val?: string): boolean {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
}

export interface ReportExportInput {
  format: "pdf" | "xlsx" | "csv";
  from?: string;
  to?: string;
  rootSevaId?: string;
  categoryId?: string;
  areaId?: string;
  assigneeId?: string;
  priority?: string;
  kind?: string;
  q?: string;
}

const emptyStringToUndefined = z.literal("").transform(() => undefined);
const optionalString = z.string().optional().or(emptyStringToUndefined);
const optionalUuid = z.string().uuid().optional().or(emptyStringToUndefined);

const reportExportSchema = z.object({
  format: z.enum(["pdf", "xlsx", "csv"]).default("csv"),
  from: optionalString,
  to: optionalString,
  rootSevaId: optionalUuid,
  categoryId: optionalUuid,
  areaId: optionalUuid,
  assigneeId: optionalUuid,
  priority: optionalString,
  kind: optionalString,
  q: optionalString,
});

async function executeReportExport(user: AuthenticatedUser, options: ReportExportInput) {
  const canViewQuotes = can(user, "quotes.view");
  const orgName = (user.settings?.["orgName"] as string) || "Seva Maintenance Management";

  const { metrics } = await computeKpis(options);

  // Detail occurrences
  let allowedSevaIds: string[] | null = null;
  if (options.rootSevaId) {
    const root = await db.seva.findUnique({ where: { id: options.rootSevaId }, select: { path: true } });
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
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.areaId ? { areaId: options.areaId } : {}),
      ...(options.assigneeId ? { assignees: { some: { userId: options.assigneeId } } } : {}),
      ...(options.priority ? { priority: options.priority as any } : {}),
      ...(options.kind ? { kind: options.kind as any } : {}),
      ...(options.q
        ? {
            OR: [
              { title: { contains: options.q, mode: "insensitive" } },
              { code: { contains: options.q, mode: "insensitive" } },
              { description: { contains: options.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    ...(isValidDate(options.from) || isValidDate(options.to)
      ? {
          dueDate: {
            ...(isValidDate(options.from) ? { gte: new Date(options.from!) } : {}),
            ...(isValidDate(options.to) ? { lte: new Date(options.to!) } : {}),
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
    code: occ.seva?.code ?? "-",
    title: occ.seva?.title ?? "-",
    category: occ.seva?.category?.name ?? "General",
    area: occ.seva?.area?.name ?? "General",
    dueDate: occ.dueDate ? format(new Date(occ.dueDate), "yyyy-MM-dd") : "-",
    status: occ.status,
    assignees: occ.seva?.assignees?.map((a) => a.user?.name).filter(Boolean).join(", ") || "Unassigned",
    completedAt: occ.completedAt ? format(new Date(occ.completedAt), "yyyy-MM-dd") : "-",
    actualCost: occ.actualCost ? Number(occ.actualCost) : "-",
  }));

  const spec: ExportTableSpec = {
    title: "Seva Maintenance Report",
    orgName,
    dateRange: options.from && options.to ? { from: options.from, to: options.to } : undefined,
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
    action: `EXPORT_${options.format.toUpperCase()}`,
    newValue: { format: options.format, rowCount: data.length },
  });

  const headers = new Headers();
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

  if (options.format === "csv") {
    const csvContent = exportToCsv(spec);
    headers.set("Content-Type", "text/csv; charset=utf-8");
    headers.set("Content-Disposition", 'attachment; filename="seva-report.csv"');
    return new NextResponse(csvContent, {
      status: 200,
      headers,
    });
  }

  if (options.format === "xlsx") {
    const excelBuffer = await exportToExcel(spec);
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    headers.set("Content-Disposition", 'attachment; filename="seva-report.xlsx"');
    return new NextResponse(new Uint8Array(excelBuffer), {
      status: 200,
      headers,
    });
  }

  // PDF
  const pdfBuffer = await exportToPdf(spec);
  headers.set("Content-Type", "application/pdf");
  headers.set("Content-Disposition", 'attachment; filename="seva-report.pdf"');
  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers,
  });
}

export const GET = withAuth({ requireAuth: true }, async (req, { user }) => {
  if (!can(user, "reports.view") && !can(user, "seva.read")) {
    return errorResponse(403, "FORBIDDEN", "Permission required: reports.view or seva.read");
  }

  const url = new URL(req.url);
  const formatParam = url.searchParams.get("format")?.toLowerCase();
  const format: "pdf" | "xlsx" | "csv" =
    formatParam === "pdf" || formatParam === "xlsx" || formatParam === "csv" ? formatParam : "csv";

  const options: ReportExportInput = {
    format,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    rootSevaId: toOptionalUuid(url.searchParams.get("rootSevaId")),
    categoryId: toOptionalUuid(url.searchParams.get("categoryId")),
    areaId: toOptionalUuid(url.searchParams.get("areaId")),
    assigneeId: toOptionalUuid(url.searchParams.get("assigneeId")),
    priority: url.searchParams.get("priority") || undefined,
    kind: url.searchParams.get("kind") || undefined,
    q: url.searchParams.get("q") || undefined,
  };

  return executeReportExport(user, options);
});

export const POST = withAuth({ requireAuth: true }, async (req, { user }) => {
  if (!can(user, "reports.view") && !can(user, "seva.read")) {
    return errorResponse(403, "FORBIDDEN", "Permission required: reports.view or seva.read");
  }

  const body = await validateBody(reportExportSchema, req);
  return executeReportExport(user, body as ReportExportInput);
});
