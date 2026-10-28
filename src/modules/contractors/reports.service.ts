import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { AuthenticatedUser } from "@/core/permissions/can";
import { getContractorTierContext } from "./tiers";
import { exportToCsv } from "@/core/export/csv";
import { exportToExcel } from "@/core/export/excel";
import { exportToPdf } from "@/core/export/pdf";
import { ExportTableSpec } from "@/core/export/types";
import { Prisma } from "@prisma/client";
import PDFDocument from "pdfkit";

export class ContractorReportsService {
  /**
   * 1. Contractor Directory Export (honours open vs restricted field tiers).
   */
  public static async exportDirectory(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser
  ) {
    const tierCtx = await getContractorTierContext(user);

    const contractors = await db.contractor.findMany({
      where: { archivedAt: null },
      orderBy: { companyName: "asc" },
      include: {
        trades: { include: { trade: true } },
        contacts: { where: { isPrimary: true } },
        reviews: {
          where: { deletedAt: null },
          select: { rating: true },
        },
      },
    });

    const data = contractors.map((c) => {
      const reviewCount = c.reviews.length;
      const avgRating =
        reviewCount > 0
          ? (c.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount).toFixed(1)
          : "N/A";

      const primaryContact = c.contacts[0];

      const row: Record<string, unknown> = {
        code: c.code,
        companyName: c.companyName,
        tradingName: c.tradingName || "",
        trades: c.trades.map((t) => t.trade.name).join(", "),
        contactName: primaryContact?.name || "",
        contactPhone: primaryContact?.phone || primaryContact?.mobile || c.mainPhone || "",
        contactEmail: primaryContact?.email || c.mainEmail || "",
        suburb: c.suburb || "",
        state: c.state || "",
        status: c.status,
        isPreferred: c.isPreferred ? "Yes" : "No",
        rating: avgRating,
      };

      if (tierCtx.canReadFull) {
        row.hourlyRate = c.hourlyRate ? `$${c.hourlyRate}/hr` : "";
        row.callOutFee = c.callOutFee ? `$${c.callOutFee}` : "";
        row.blockedReason = c.blockedReason || "";
        row.internalNotes = c.internalNotes || "";
      }

      return row;
    });

    const columns: ExportTableSpec<any>["columns"] = [
      { key: "code", header: "Code", width: 12 },
      { key: "companyName", header: "Company Name", width: 25 },
      { key: "tradingName", header: "Trading Name", width: 20 },
      { key: "trades", header: "Trades", width: 25 },
      { key: "contactName", header: "Primary Contact", width: 20 },
      { key: "contactPhone", header: "Phone", width: 15 },
      { key: "contactEmail", header: "Email", width: 25 },
      { key: "suburb", header: "Suburb", width: 15 },
      { key: "state", header: "State", width: 8 },
      { key: "status", header: "Status", width: 12 },
      { key: "isPreferred", header: "Preferred", width: 10 },
      { key: "rating", header: "Rating", width: 10 },
    ];

    if (tierCtx.canReadFull) {
      columns.push(
        { key: "hourlyRate", header: "Hourly Rate", width: 12 },
        { key: "callOutFee", header: "Call Out Fee", width: 12 },
        { key: "blockedReason", header: "Blocked Reason", width: 20 },
        { key: "internalNotes", header: "Internal Notes", width: 30 }
      );
    }

    const spec: ExportTableSpec<any> = {
      title: "Contractor Directory",
      columns,
      data,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      generatedBy: user.name,
      summary: {
        "Total Contractors": contractors.length,
        Active: contractors.filter((c) => c.status === "ACTIVE").length,
        Preferred: contractors.filter((c) => c.isPreferred).length,
      },
    };

    if (format === "csv") return { buffer: Buffer.from(exportToCsv(spec), "utf-8"), contentType: "text/csv", filename: "contractors-directory.csv" };
    if (format === "xlsx") return { buffer: await exportToExcel(spec), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "contractors-directory.xlsx" };
    return { buffer: await exportToPdf(spec), contentType: "application/pdf", filename: "contractors-directory.pdf" };
  }

  /**
   * 2. Credential Expiry Report.
   */
  public static async exportCredentialExpiry(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser,
    horizonDays: number = 60
  ) {
    const tierCtx = await getContractorTierContext(user);

    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + horizonDays);

    const credentials = await db.contractorCredential.findMany({
      where: {
        expiresAt: { lte: horizonDate },
        status: { in: ["VALID", "EXPIRING_SOON", "EXPIRED"] },
        contractor: { archivedAt: null },
      },
      orderBy: { expiresAt: "asc" },
      include: {
        contractor: {
          select: { code: true, companyName: true, status: true },
        },
      },
    });

    const data = credentials.map((cred) => ({
      contractorCode: cred.contractor.code,
      companyName: cred.contractor.companyName,
      type: cred.type,
      kind: cred.kind,
      status: cred.status,
      expiresAt: tierCtx.canViewCredentials && cred.expiresAt ? cred.expiresAt.toISOString().slice(0, 10) : "(Restricted)",
      number: tierCtx.canViewCredentials && cred.number ? cred.number : "(Restricted)",
      issuer: cred.issuer || "",
    }));

    const columns: ExportTableSpec<any>["columns"] = [
      { key: "contractorCode", header: "Contractor Code", width: 14 },
      { key: "companyName", header: "Company Name", width: 25 },
      { key: "kind", header: "Kind", width: 14 },
      { key: "type", header: "Credential Type", width: 20 },
      { key: "status", header: "Status", width: 14 },
      { key: "expiresAt", header: "Expires At", width: 14 },
      { key: "number", header: "Credential No.", width: 18 },
      { key: "issuer", header: "Issuer/Insurer", width: 20 },
    ];

    const spec: ExportTableSpec<any> = {
      title: `Contractor Credential Expiry Report (${horizonDays} Days)`,
      columns,
      data,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      generatedBy: user.name,
      summary: {
        "Total Expiring/Expired": credentials.length,
        "Already Expired": credentials.filter((c) => c.status === "EXPIRED").length,
        "Expiring Soon": credentials.filter((c) => c.status === "EXPIRING_SOON").length,
      },
    };

    if (format === "csv") return { buffer: Buffer.from(exportToCsv(spec), "utf-8"), contentType: "text/csv", filename: "credential-expiry-report.csv" };
    if (format === "xlsx") return { buffer: await exportToExcel(spec), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "credential-expiry-report.xlsx" };
    return { buffer: await exportToPdf(spec), contentType: "application/pdf", filename: "credential-expiry-report.pdf" };
  }

  /**
   * 3. Spend Report for Date Range (Restricted Tier: requires contractors.readFull).
   */
  public static async exportSpendReport(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser,
    params: {
      from?: string;
      to?: string;
      contractorId?: string;
      tradeId?: string;
      categoryId?: string;
      projectSubtreeSevaId?: string;
    }
  ) {
    const tierCtx = await getContractorTierContext(user);
    if (!tierCtx.canReadFull) {
      throw new AppError(403, "FORBIDDEN", "Financial spend reports require contractors.readFull permission");
    }

    const where: Prisma.SevaContractorWhereInput = {};

    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    if (params.contractorId) {
      where.contractorId = params.contractorId;
    }

    // Filter by project subtree if provided
    if (params.projectSubtreeSevaId) {
      const rootSeva = await db.seva.findUnique({
        where: { id: params.projectSubtreeSevaId },
        select: { path: true },
      });
      if (rootSeva) {
        const subtreeSevas = await db.seva.findMany({
          where: { path: { startsWith: rootSeva.path } },
          select: { id: true },
        });
        where.sevaId = { in: subtreeSevas.map((s) => s.id) };
      }
    }

    // Filter by category if provided
    if (params.categoryId) {
      where.seva = {
        is: {
          categoryId: params.categoryId,
        },
      };
    }

    // Filter by trade if provided
    if (params.tradeId) {
      where.contractor = {
        is: {
          trades: { some: { tradeId: params.tradeId } },
        },
      };
    }

    const links = await db.sevaContractor.findMany({
      where,
      include: {
        contractor: { select: { code: true, companyName: true } },
        seva: { select: { code: true, title: true, category: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    let totalQuoted = 0;
    let totalFinal = 0;
    let totalInvoiced = 0;

    const data = links.map((link) => {
      const quoted = link.quotedAmount ? Number(link.quotedAmount) : 0;
      const finalAmt = link.finalAmount ? Number(link.finalAmount) : 0;
      const invoiced = link.invoicedAmount ? Number(link.invoicedAmount) : 0;

      totalQuoted += quoted;
      totalFinal += finalAmt;
      totalInvoiced += invoiced;

      return {
        contractor: `${link.contractor.code} - ${link.contractor.companyName}`,
        seva: `${link.seva.code} - ${link.seva.title}`,
        category: link.seva.category.name,
        role: link.role,
        status: link.status,
        quotedAmount: quoted ? `$${quoted.toFixed(2)}` : "$0.00",
        finalAmount: finalAmt ? `$${finalAmt.toFixed(2)}` : "$0.00",
        invoicedAmount: invoiced ? `$${invoiced.toFixed(2)}` : "$0.00",
        invoiceNumber: link.invoiceNumber || "",
        paidAt: link.paidAt ? link.paidAt.toISOString().slice(0, 10) : "",
      };
    });

    const columns: ExportTableSpec<any>["columns"] = [
      { key: "contractor", header: "Contractor", width: 25 },
      { key: "seva", header: "Seva Task", width: 25 },
      { key: "category", header: "Category", width: 16 },
      { key: "role", header: "Role", width: 12 },
      { key: "status", header: "Status", width: 12 },
      { key: "quotedAmount", header: "Quoted ($)", width: 14 },
      { key: "finalAmount", header: "Final ($)", width: 14 },
      { key: "invoicedAmount", header: "Invoiced ($)", width: 14 },
      { key: "invoiceNumber", header: "Invoice #", width: 14 },
      { key: "paidAt", header: "Paid Date", width: 12 },
    ];

    const spec: ExportTableSpec<any> = {
      title: "Contractor Spend & Financial Report",
      columns,
      data,
      dateRange: params.from && params.to ? { from: params.from, to: params.to } : undefined,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      generatedBy: user.name,
      summary: {
        "Total Jobs": links.length,
        "Total Quoted": `$${totalQuoted.toFixed(2)}`,
        "Total Final": `$${totalFinal.toFixed(2)}`,
        "Total Invoiced": `$${totalInvoiced.toFixed(2)}`,
      },
    };

    if (format === "csv") return { buffer: Buffer.from(exportToCsv(spec), "utf-8"), contentType: "text/csv", filename: "contractor-spend-report.csv" };
    if (format === "xlsx") return { buffer: await exportToExcel(spec), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "contractor-spend-report.xlsx" };
    return { buffer: await exportToPdf(spec), contentType: "application/pdf", filename: "contractor-spend-report.pdf" };
  }

  /**
   * 4. Contractor Performance Report (Restricted Tier: requires contractors.readFull).
   */
  public static async exportPerformanceReport(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser
  ) {
    const tierCtx = await getContractorTierContext(user);
    if (!tierCtx.canReadFull) {
      throw new AppError(403, "FORBIDDEN", "Performance reports require contractors.readFull permission");
    }

    const contractors = await db.contractor.findMany({
      where: { archivedAt: null },
      include: {
        sevas: {
          include: {
            seva: { select: { dueDate: true } },
          },
        },
        reviews: {
          where: { deletedAt: null },
          select: { rating: true, wouldUseAgain: true },
        },
      },
    });

    const data = (contractors as any[]).map((c: any) => {
      const jobsCount = c.sevas.length;
      const completedJobs = c.sevas.filter((l: any) => l.status === "COMPLETED");
      const engagedOrCompleted = c.sevas.filter((l: any) => ["ENGAGED", "COMPLETED"].includes(l.status)).length;
      const quoteWinRate = jobsCount > 0 ? Math.round((engagedOrCompleted / jobsCount) * 100) : 0;

      // On-time rate: completed before or on seva due date
      let onTimeCount = 0;
      for (const link of completedJobs) {
        if (link.completedAt && link.seva.dueDate) {
          if (link.completedAt <= link.seva.dueDate) onTimeCount++;
        } else {
          onTimeCount++;
        }
      }
      const onTimeRate = completedJobs.length > 0 ? Math.round((onTimeCount / completedJobs.length) * 100) : 100;

      const reviewCount = c.reviews.length;
      const avgRating =
        reviewCount > 0
          ? (c.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviewCount).toFixed(1)
          : "N/A";

      const repeatUseCount = jobsCount > 1 ? jobsCount : 0;

      return {
        code: c.code,
        companyName: c.companyName,
        status: c.status,
        jobsCount,
        completedJobs: completedJobs.length,
        avgRating,
        onTimeRate: `${onTimeRate}%`,
        repeatUseCount,
        quoteWinRate: `${quoteWinRate}%`,
      };
    });

    const columns: ExportTableSpec<any>["columns"] = [
      { key: "code", header: "Code", width: 12 },
      { key: "companyName", header: "Company Name", width: 25 },
      { key: "status", header: "Status", width: 12 },
      { key: "jobsCount", header: "Total Jobs", width: 12 },
      { key: "completedJobs", header: "Completed", width: 12 },
      { key: "avgRating", header: "Avg Rating", width: 12 },
      { key: "onTimeRate", header: "On-Time %", width: 12 },
      { key: "repeatUseCount", header: "Repeat Jobs", width: 12 },
      { key: "quoteWinRate", header: "Quote Win %", width: 14 },
    ];

    const spec: ExportTableSpec<any> = {
      title: "Contractor Performance & Reliability Report",
      columns,
      data,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      generatedBy: user.name,
      summary: {
        "Total Contractors": contractors.length,
        "Active Engagements": contractors.reduce((acc: number, c: any) => acc + c.sevas.filter((l: any) => l.status === "ENGAGED").length, 0),
      },
    };

    if (format === "csv") return { buffer: Buffer.from(exportToCsv(spec), "utf-8"), contentType: "text/csv", filename: "contractor-performance.csv" };
    if (format === "xlsx") return { buffer: await exportToExcel(spec), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "contractor-performance.xlsx" };
    return { buffer: await exportToPdf(spec), contentType: "application/pdf", filename: "contractor-performance.pdf" };
  }

  /**
   * 5. Single Contractor Profile Sheet (Printable PDF).
   */
  public static async generateProfileSheet(contractorId: string, user: AuthenticatedUser): Promise<Buffer> {
    const tierCtx = await getContractorTierContext(user);

    const contractor = await db.contractor.findUnique({
      where: { id: contractorId },
      include: {
        trades: { include: { trade: true } },
        contacts: { where: { isActive: true }, orderBy: { isPrimary: "desc" } },
        credentials: { orderBy: { createdAt: "desc" } },
        reviews: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: { reviewedBy: { select: { name: true } } },
        },
        sevas: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            seva: { select: { code: true, title: true } },
          },
        },
      },
    });

    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");
    const c = contractor as any;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
        const chunks: Buffer[] = [];
        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", (err: Error) => reject(err));

        // Header Banner
        doc.font("Helvetica-Bold").fontSize(20).fillColor("#1e293b").text(c.companyName);
        if (c.tradingName) {
          doc.font("Helvetica").fontSize(12).fillColor("#64748b").text(`Trading as: ${c.tradingName}`);
        }
        doc.font("Helvetica").fontSize(10).fillColor("#4f46e5").text(`Code: ${c.code}  |  Status: ${c.status}  |  Preferred: ${c.isPreferred ? "YES" : "NO"}`);
        doc.moveDown(0.75);

        // Trades & Basic details
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Company & Contact Information", { underline: true });
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(9).fillColor("#334155");
        doc.text(`Trades: ${c.trades.map((t: any) => t.trade.name + (t.isPrimary ? " (Primary)" : "")).join(", ") || "None"}`);
        doc.text(`Registration: ${c.registrationType || "ABN"} ${c.registrationNumber || "Not registered"}`);
        doc.text(`GST Registered: ${c.gstRegistered ? "Yes" : "No"}`);
        doc.text(`Main Phone: ${c.mainPhone || "N/A"}  |  Main Email: ${c.mainEmail || "N/A"}`);
        doc.text(`Emergency Phone: ${c.emergencyPhone || "N/A"}  |  After Hours: ${c.afterHoursAvailable ? "Available" : "No"}`);
        doc.text(`Address: ${[c.addressLine1, c.suburb, c.state, c.postcode].filter(Boolean).join(", ") || "N/A"}`);
        doc.text(`Website: ${c.website || "N/A"}`);
        doc.moveDown(0.75);

        // Contacts
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Contacts", { underline: true });
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(9).fillColor("#334155");
        for (const contact of c.contacts) {
          doc.text(`• ${contact.name}${contact.isPrimary ? " [Primary]" : ""}${contact.jobTitle ? ` (${contact.jobTitle})` : ""}: Phone: ${contact.phone || contact.mobile || "N/A"}, Email: ${contact.email || "N/A"}`);
        }
        doc.moveDown(0.75);

        // Credentials
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Credentials & Compliance", { underline: true });
        doc.moveDown(0.25);
        doc.font("Helvetica").fontSize(9).fillColor("#334155");
        for (const cred of c.credentials) {
          const numStr = tierCtx.canViewCredentials && cred.number ? ` (No. ${cred.number})` : "";
          const expStr = tierCtx.canViewCredentials && cred.expiresAt ? ` - Expires: ${cred.expiresAt.toISOString().slice(0, 10)}` : "";
          doc.text(`• [${cred.kind}] ${cred.type}${numStr} - Status: ${cred.status}${expStr}`);
        }
        doc.moveDown(0.75);

        // Restricted Tier Rates & Financials
        if (tierCtx.canReadFull) {
          doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Rates & Terms (Restricted)", { underline: true });
          doc.moveDown(0.25);
          doc.font("Helvetica").fontSize(9).fillColor("#334155");
          doc.text(`Hourly Rate: ${c.hourlyRate ? `$${c.hourlyRate}/hr` : "Not set"}  |  Call Out Fee: ${c.callOutFee ? `$${c.callOutFee}` : "None"}`);
          doc.text(`Payment Terms: ${c.paymentTerms || "Standard"}`);
          if (c.internalNotes) {
            doc.text(`Internal Notes: ${c.internalNotes}`);
          }
          doc.moveDown(0.75);
        }

        // Recent Jobs
        doc.font("Helvetica-Bold").fontSize(12).fillColor("#0f172a").text("Recent Seva Tasks", { underline: true });
        doc.moveDown(0.25);
        if (c.sevas.length === 0) {
          doc.font("Helvetica").fontSize(9).fillColor("#64748b").text("No seva tasks linked yet.");
        } else {
          doc.font("Helvetica").fontSize(9).fillColor("#334155");
          for (const link of c.sevas) {
            const amtStr = tierCtx.canReadFull && link.finalAmount ? ` - Final: $${link.finalAmount}` : "";
            doc.text(`• [${link.role}] ${link.seva.code}: ${link.seva.title} (Status: ${link.status}${amtStr})`);
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * 6. Requests Report: counts and turnaround time by status.
   */
  public static async exportRequestsReport(
    format: "csv" | "xlsx" | "pdf",
    user: AuthenticatedUser
  ) {
    const requests = await db.contractorRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });

    let totalTurnaroundHours = 0;
    let reviewedCount = 0;

    const data = requests.map((req) => {
      let turnaroundHours: number | null = null;
      if (req.reviewedAt) {
        turnaroundHours = Number(
          ((req.reviewedAt.getTime() - req.createdAt.getTime()) / (1000 * 60 * 60)).toFixed(1)
        );
        totalTurnaroundHours += turnaroundHours;
        reviewedCount++;
      }

      return {
        code: req.code,
        type: req.type,
        status: req.status,
        requestedBy: req.requestedBy.name,
        requestedAt: req.createdAt.toISOString().slice(0, 10),
        reviewedBy: req.reviewedBy?.name || "Pending",
        reviewedAt: req.reviewedAt ? req.reviewedAt.toISOString().slice(0, 10) : "Pending",
        turnaroundHours: turnaroundHours !== null ? `${turnaroundHours} hrs` : "N/A",
      };
    });

    const avgTurnaround =
      reviewedCount > 0 ? (totalTurnaroundHours / reviewedCount).toFixed(1) : "N/A";

    const columns: ExportTableSpec<any>["columns"] = [
      { key: "code", header: "Code", width: 14 },
      { key: "type", header: "Type", width: 18 },
      { key: "status", header: "Status", width: 14 },
      { key: "requestedBy", header: "Requester", width: 20 },
      { key: "requestedAt", header: "Requested Date", width: 14 },
      { key: "reviewedBy", header: "Reviewer", width: 20 },
      { key: "reviewedAt", header: "Review Date", width: 14 },
      { key: "turnaroundHours", header: "Turnaround", width: 14 },
    ];

    const spec: ExportTableSpec<any> = {
      title: "Contractor Requests & Turnaround Report",
      columns,
      data,
      generatedAt: new Date().toISOString().replace("T", " ").slice(0, 19),
      generatedBy: user.name,
      summary: {
        "Total Requests": requests.length,
        Open: requests.filter((r) => r.status === "OPEN").length,
        Approved: requests.filter((r) => r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED").length,
        Rejected: requests.filter((r) => r.status === "REJECTED").length,
        "Average Turnaround": `${avgTurnaround} hrs`,
      },
    };

    if (format === "csv") return { buffer: Buffer.from(exportToCsv(spec), "utf-8"), contentType: "text/csv", filename: "contractor-requests-report.csv" };
    if (format === "xlsx") return { buffer: await exportToExcel(spec), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename: "contractor-requests-report.xlsx" };
    return { buffer: await exportToPdf(spec), contentType: "application/pdf", filename: "contractor-requests-report.pdf" };
  }
}
