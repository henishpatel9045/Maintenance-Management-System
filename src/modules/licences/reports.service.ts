import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { AuthenticatedUser } from "@/core/permissions/can";
import { getLicenceTierContext, maskLicenceNumber } from "./tiers";
import { isLicenceValidOnDate } from "./holder";
import { exportToCsv, neutralizeFormula } from "@/core/export/csv";
import { exportToExcel } from "@/core/export/excel";
import { exportToPdf } from "@/core/export/pdf";
import { ExportTableSpec } from "@/core/export/types";
import PDFDocument from "pdfkit";

export const safeFormulaCell = neutralizeFormula;

export class LicenceReportsService {
  /**
   * 1. Holders by Licence Type Report
   */
  public static async exportHoldersByType(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser,
    options: { licenceTypeId?: string; status?: string; class?: string } = {}
  ) {
    const tierCtx = getLicenceTierContext(user);

    const licences = await db.userLicence.findMany({
      where: {
        archivedAt: null,
        supersededById: null,
        user: { isActive: true },
        ...(options.licenceTypeId ? { licenceTypeId: options.licenceTypeId } : {}),
        ...(options.status ? { status: options.status as any } : {}),
        ...(options.class ? { class: { equals: options.class, mode: "insensitive" } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        licenceType: { include: { category: true } },
      },
      orderBy: [{ licenceType: { name: "asc" } }, { user: { name: "asc" } }],
    });

    const data = licences.map((l) => {
      const isHighlySensitive = l.licenceType.isHighlySensitive;
      const canSeeSensitive = isHighlySensitive
        ? tierCtx.canSensitiveView && tierCtx.canDocumentsView
        : tierCtx.canSensitiveView;

      const row: Record<string, unknown> = {
        userName: l.user.name,
        category: l.licenceType.category.name,
        licenceType: l.licenceType.name,
        class: l.class || "N/A",
        status: l.status,
        expiry: isHighlySensitive ? "Protected" : l.expiresAt ? l.expiresAt.toISOString().split("T")[0] : "No Expiry",
      };

      if (tierCtx.canDirectoryContact || tierCtx.canManage) {
        row.email = l.user.email;
        row.phone = l.user.phone || "";
      }

      // Licence number: never included unless sensitive.view, and never for highly sensitive in bulk reports
      if (canSeeSensitive && !isHighlySensitive) {
        row.licenceNumber = maskLicenceNumber(l.licenceNumber) || "";
      }

      return row;
    });

    const columns = [
      { key: "userName", header: "Holder Name", width: 22 },
      { key: "category", header: "Category", width: 18 },
      { key: "licenceType", header: "Licence Type", width: 24 },
      { key: "class", header: "Class", width: 12 },
      { key: "status", header: "Status", width: 14 },
      { key: "expiry", header: "Expiry Date", width: 14 },
    ];

    if (tierCtx.canDirectoryContact || tierCtx.canManage) {
      columns.push({ key: "phone", header: "Phone", width: 16 });
      columns.push({ key: "email", header: "Email", width: 24 });
    }

    if (tierCtx.canSensitiveView) {
      columns.push({ key: "licenceNumber", header: "Licence No.", width: 16 });
    }

    const spec: ExportTableSpec<any> = {
      title: "Licence Holders Register",
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
      summary: { "Total Records": data.length },
    };

    return this.renderSpec(spec, format, "licence_holders");
  }

  /**
   * 2. Expiry Report (Expired and Expiring within N days)
   */
  public static async exportExpiryReport(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser,
    withinDays: number = 60
  ) {
    const tierCtx = getLicenceTierContext(user);
    const now = new Date();
    const threshold = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const licences = await db.userLicence.findMany({
      where: {
        archivedAt: null,
        supersededById: null,
        user: { isActive: true },
        OR: [
          { status: "EXPIRED" },
          { status: "EXPIRING_SOON" },
          { expiresAt: { lte: threshold } },
        ],
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        licenceType: { include: { category: true } },
      },
      orderBy: { expiresAt: "asc" },
    });

    const data = licences.map((l) => {
      const isHighlySensitive = l.licenceType.isHighlySensitive;
      let expiryText = "N/A";
      let daysRemaining = "N/A";

      if (l.expiresAt) {
        expiryText = l.expiresAt.toISOString().split("T")[0]!;
        const diff = Math.round((new Date(l.expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        daysRemaining = diff < 0 ? `Expired (${Math.abs(diff)}d ago)` : `${diff} days`;
      }

      const row: Record<string, unknown> = {
        userName: l.user.name,
        licenceType: l.licenceType.name,
        class: l.class || "N/A",
        status: l.status,
        expiresAt: isHighlySensitive ? "Protected" : expiryText,
        daysRemaining: isHighlySensitive ? "Protected" : daysRemaining,
      };

      if (tierCtx.canDirectoryContact || tierCtx.canManage) {
        row.phone = l.user.phone || "";
        row.email = l.user.email;
      }

      return row;
    });

    const columns = [
      { key: "userName", header: "Holder Name", width: 22 },
      { key: "licenceType", header: "Licence / Ticket", width: 24 },
      { key: "class", header: "Class", width: 12 },
      { key: "status", header: "Status", width: 14 },
      { key: "expiresAt", header: "Expiry Date", width: 14 },
      { key: "daysRemaining", header: "Remaining", width: 16 },
    ];

    if (tierCtx.canDirectoryContact || tierCtx.canManage) {
      columns.push({ key: "phone", header: "Phone", width: 16 });
      columns.push({ key: "email", header: "Email", width: 24 });
    }

    const spec: ExportTableSpec<any> = {
      title: `Licence Expiry Report (Next ${withinDays} Days)`,
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
      summary: { "At-Risk Licences": data.length },
    };

    return this.renderSpec(spec, format, "licence_expiry_report");
  }

  /**
   * 3. Licence Matrix Export
   */
  public static async exportMatrixReport(
    format: "csv" | "xlsx" | "pdf",
    _user: AuthenticatedUser
  ) {
    const types = await db.licenceType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const users = await db.user.findMany({
      where: { isActive: true },
      include: {
        licences: {
          where: { archivedAt: null, supersededById: null },
          include: { licenceType: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const columns = [
      { key: "userName", header: "Person Name", width: 24 },
      ...types.map((t) => ({
        key: `type_${t.id}`,
        header: t.name,
        width: 16,
      })),
    ];

    const data = users
      .filter((u) => u.licences.length > 0)
      .map((u) => {
        const row: Record<string, unknown> = {
          userName: u.name,
        };

        for (const t of types) {
          const lic = u.licences.find((l) => l.licenceTypeId === t.id);
          if (!lic) {
            row[`type_${t.id}`] = "—";
          } else {
            const classSuffix = lic.class ? ` (${lic.class})` : "";
            row[`type_${t.id}`] = `${lic.status}${classSuffix}`;
          }
        }

        return row;
      });

    const spec: ExportTableSpec<any> = {
      title: "Licence & Competencies Matrix",
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
      summary: { "Active Holders": data.length },
    };

    return this.renderSpec(spec, format, "licence_matrix");
  }

  /**
   * 4. Gap Report (Types Below Target)
   */
  public static async exportGapReport(
    format: "csv" | "xlsx" | "pdf",
    _user: AuthenticatedUser
  ) {
    const types = await db.licenceType.findMany({
      where: { isActive: true, minHoldersTarget: { not: null, gt: 0 } },
      include: {
        category: true,
        userLicences: {
          where: {
            archivedAt: null,
            supersededById: null,
            user: { isActive: true },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const data = types.map((t) => {
      const validHolders = new Set(
        t.userLicences
          .filter((l) => isLicenceValidOnDate(l, now))
          .map((l) => l.userId)
      ).size;

      const target = t.minHoldersTarget || 0;
      const shortfall = Math.max(0, target - validHolders);
      const isBelow = validHolders < target;

      return {
        category: t.category.name,
        licenceType: t.name,
        kind: t.kind,
        target,
        currentHolders: validHolders,
        shortfall,
        status: isBelow ? "DEFICIT" : "MET",
      };
    });

    const columns = [
      { key: "category", header: "Category", width: 18 },
      { key: "licenceType", header: "Licence Type", width: 24 },
      { key: "kind", header: "Kind", width: 14 },
      { key: "target", header: "Target", width: 10 },
      { key: "currentHolders", header: "Current", width: 10 },
      { key: "shortfall", header: "Shortfall", width: 10 },
      { key: "status", header: "Status", width: 12 },
    ];

    const deficitCount = data.filter((d) => d.shortfall > 0).length;

    const spec: ExportTableSpec<any> = {
      title: "Licence Capacity & Gap Report",
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
      summary: { "Types Below Target": deficitCount },
    };

    return this.renderSpec(spec, format, "licence_gap_report");
  }

  /**
   * 5. Person Licence Sheet (Printable PDF for a single user)
   */
  public static async exportPersonSheet(
    targetUserId: string,
    user: AuthenticatedUser
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const tierCtx = getLicenceTierContext(user);
    const isOwn = user.id === targetUserId;

    if (!isOwn && !tierCtx.canManage && !tierCtx.canReportsView) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to generate this user's licence sheet");
    }

    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      include: {
        availability: true,
        licences: {
          where: { archivedAt: null, supersededById: null },
          include: { licenceType: { include: { category: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!targetUser) throw new AppError(404, "USER_NOT_FOUND", "User not found");

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: "application/pdf",
          filename: `licence_sheet_${targetUser.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.pdf`,
        });
      });
      doc.on("error", reject);

      // Header
      doc.fontSize(20).text("Volunteer Competencies & Licence Sheet", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(10).fillColor("#666666").text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(1.5);

      // User Bio Box
      doc.fillColor("#000000").fontSize(12).font("Helvetica-Bold").text("Volunteer Profile");
      doc.font("Helvetica").fontSize(10);
      doc.text(`Name: ${targetUser.name}`);
      doc.text(`Email: ${targetUser.email}`);
      if (targetUser.phone) doc.text(`Phone: ${targetUser.phone}`);
      doc.text(`Availability: ${targetUser.availability?.status || "AVAILABLE"}${targetUser.availability?.note ? ` (${targetUser.availability.note})` : ""}`);
      doc.moveDown(1.5);

      // Licences List
      doc.fontSize(12).font("Helvetica-Bold").text("Registered Licences & Tickets");
      doc.moveDown(0.5);

      if (targetUser.licences.length === 0) {
        doc.font("Helvetica-Oblique").fontSize(10).text("No licences currently registered.");
      } else {
        for (const lic of targetUser.licences) {
          const isHighlySensitive = lic.licenceType.isHighlySensitive;
          const canSeeSensitive = isOwn || (tierCtx.canSensitiveView && tierCtx.canDocumentsView);

          if (isHighlySensitive && !canSeeSensitive) {
            // Excluded from sheet for unauthorized viewers
            continue;
          }

          doc.font("Helvetica-Bold").fontSize(11).text(lic.licenceType.name);
          doc.font("Helvetica").fontSize(9);
          doc.text(`Category: ${lic.licenceType.category.name} | Kind: ${lic.licenceType.kind}${lic.class ? ` | Class: ${lic.class}` : ""}`);
          doc.text(`Status: ${lic.status}${lic.expiresAt ? ` | Expires: ${lic.expiresAt.toISOString().split("T")[0]}` : " | No Expiry"}`);

          if (canSeeSensitive && lic.licenceNumber) {
            doc.text(`Licence Number: ${lic.licenceNumber}`);
          }
          if (lic.issuer) doc.text(`Issuer: ${lic.issuer}`);
          if (lic.conditions) doc.text(`Conditions: ${lic.conditions}`);
          doc.moveDown(0.8);
        }
      }

      doc.end();
    });
  }

  /**
   * 6. Compliance by Seva Report
   */
  public static async exportSevaCompliance(
    format: "csv" | "xlsx" | "pdf",
    _user: AuthenticatedUser
  ) {
    const sevas = await db.seva.findMany({
      where: {
        isArchived: false,
        requiredLicences: { some: {} },
      },
      include: {
        requiredLicences: { include: { licenceType: true } },
        assignees: {
          include: {
            user: {
              include: {
                licences: {
                  where: { archivedAt: null, supersededById: null },
                },
              },
            },
          },
        },
        occurrences: {
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
      orderBy: { code: "asc" },
    });

    const now = new Date();
    const data = sevas.map((s) => {
      const evalDate = s.occurrences[0]?.dueDate
        ? new Date(s.occurrences[0].dueDate)
        : s.dueDate
        ? new Date(s.dueDate)
        : now;
      let allMet = true;

      const reqDetails = s.requiredLicences.map((req) => {
        const qualifyingCount = s.assignees.filter((a) => {
          if (!a.user.isActive) return false;
          return a.user.licences.some(
            (l) => l.licenceTypeId === req.licenceTypeId && isLicenceValidOnDate(l, evalDate)
          );
        }).length;

        const isMet = qualifyingCount >= req.minHolders;
        if (!isMet) allMet = false;
        return `${req.licenceType.name}: ${qualifyingCount}/${req.minHolders}`;
      });

      return {
        code: s.code,
        title: s.title,
        dueDate: evalDate.toISOString().split("T")[0],
        assigneesCount: s.assignees.length,
        requirements: reqDetails.join("; "),
        compliant: allMet ? "COMPLIANT" : "NON-COMPLIANT",
      };
    });

    const columns = [
      { key: "code", header: "Seva Code", width: 14 },
      { key: "title", header: "Seva Title", width: 28 },
      { key: "dueDate", header: "Due Date", width: 12 },
      { key: "assigneesCount", header: "Assignees", width: 10 },
      { key: "requirements", header: "Licence Requirements", width: 32 },
      { key: "compliant", header: "Status", width: 16 },
    ];

    const spec: ExportTableSpec<any> = {
      title: "Seva Licence Compliance Report",
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
      summary: { "Monitored Tasks": data.length },
    };

    return this.renderSpec(spec, format, "seva_licence_compliance");
  }

  /**
   * 7. Weekly Trend Report
   */
  public static async exportTrendReport(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser,
    typeId?: string
  ) {
    const snapshots = await db.licenceCountSnapshot.findMany({
      where: typeId ? { licenceTypeId: typeId } : {},
      include: { licenceType: true },
      orderBy: [{ takenOn: "asc" }, { licenceType: { name: "asc" } }],
    });

    const data = snapshots.map((s) => ({
      date: s.takenOn.toISOString().split("T")[0],
      licenceType: s.licenceType.name,
      validHolders: s.validHolders,
      expiringSoon: s.expiringSoon,
      expired: s.expired,
      pending: s.pending,
    }));

    const columns = [
      { key: "date", header: "Snapshot Date", width: 14 },
      { key: "licenceType", header: "Licence Type", width: 24 },
      { key: "validHolders", header: "Valid Holders", width: 14 },
      { key: "expiringSoon", header: "Expiring Soon", width: 14 },
      { key: "expired", header: "Expired", width: 12 },
      { key: "pending", header: "Pending", width: 12 },
    ];

    const spec: ExportTableSpec<any> = {
      title: "Weekly Licence Trends Report",
      orgName: "Seva Maintenance Management",
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      columns,
      data,
    };

    return this.renderSpec(spec, format, "licence_trends_report");
  }

  private static async renderSpec(
    spec: ExportTableSpec<any>,
    format: "csv" | "xlsx" | "pdf",
    baseName: string
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const csvStr = exportToCsv(spec);
      return {
        buffer: Buffer.from(csvStr, "utf-8"),
        contentType: "text/csv; charset=utf-8",
        filename: `${baseName}_${dateStr}.csv`,
      };
    } else if (format === "xlsx") {
      const xlsxBuf = await exportToExcel(spec);
      return {
        buffer: xlsxBuf,
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename: `${baseName}_${dateStr}.xlsx`,
      };
    } else {
      const pdfBuf = await exportToPdf(spec);
      return {
        buffer: pdfBuf,
        contentType: "application/pdf",
        filename: `${baseName}_${dateStr}.pdf`,
      };
    }
  }
}
