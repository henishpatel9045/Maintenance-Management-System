import PDFDocument from "pdfkit";
import { ExportTableSpec } from "./types";

export function exportToPdf<T>(spec: ExportTableSpec<T>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 36,
        size: "A4",
        layout: "landscape",
        bufferPages: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      // Header
      if (spec.orgName) {
        doc.fontSize(16).fillColor("#4f46e5").text(spec.orgName, { align: "left" });
      }
      doc.fontSize(14).fillColor("#1e293b").text(spec.title, { align: "left" });
      doc.moveDown(0.25);

      const metadataLine: string[] = [];
      if (spec.dateRange) {
        metadataLine.push(`Date Range: ${spec.dateRange.from} to ${spec.dateRange.to}`);
      }
      if (spec.generatedAt) {
        metadataLine.push(`Generated: ${spec.generatedAt}`);
      }
      if (spec.generatedBy) {
        metadataLine.push(`By: ${spec.generatedBy}`);
      }
      if (metadataLine.length > 0) {
        doc.fontSize(9).fillColor("#64748b").text(metadataLine.join("  |  "));
      }

      doc.moveDown(0.5);

      // Summary KPIs if provided
      if (spec.summary) {
        doc.fontSize(10).fillColor("#334155").text("Summary Metrics:", { underline: true });
        const summaryText = Object.entries(spec.summary)
          .map(([k, v]) => `${k}: ${v}`)
          .join("   •   ");
        doc.fontSize(8.5).fillColor("#475569").text(summaryText);
        doc.moveDown(0.75);
      }

      // Draw Table
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const numCols = spec.columns.length;
      const colWidth = pageWidth / numCols;

      let yPos = doc.y;

      // Header Row
      doc.rect(doc.page.margins.left, yPos, pageWidth, 20).fill("#4f46e5");
      doc.fillColor("#ffffff").fontSize(8).font("Helvetica-Bold");

      spec.columns.forEach((col, idx) => {
        const xPos = doc.page.margins.left + idx * colWidth;
        doc.text(col.header, xPos + 4, yPos + 6, {
          width: colWidth - 8,
          lineBreak: false,
          ellipsis: true,
        });
      });

      yPos += 20;

      // Table Data
      doc.font("Helvetica").fontSize(7.5);
      spec.data.forEach((row, rowIdx) => {
        // Page break check
        if (yPos > doc.page.height - doc.page.margins.bottom - 20) {
          doc.addPage();
          yPos = doc.page.margins.top;
        }

        const bgColor = rowIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
        doc.rect(doc.page.margins.left, yPos, pageWidth, 18).fill(bgColor);
        doc.fillColor("#1e293b");

        spec.columns.forEach((col, idx) => {
          const xPos = doc.page.margins.left + idx * colWidth;
          const val = col.format ? col.format(row) : (row as any)[col.key];
          const textVal = val !== undefined && val !== null ? String(val) : "";
          doc.text(textVal, xPos + 4, yPos + 5, {
            width: colWidth - 8,
            lineBreak: false,
            ellipsis: true,
          });
        });

        yPos += 18;
      });

      // Page numbers footer
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor("#94a3b8").text(
          `Page ${i + 1} of ${pages.count} — Seva Maintenance Management System`,
          doc.page.margins.left,
          doc.page.height - doc.page.margins.bottom + 8,
          { align: "center", width: pageWidth }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
