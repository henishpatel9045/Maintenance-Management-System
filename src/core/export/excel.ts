import ExcelJS from "exceljs";
import { ExportTableSpec } from "./types";

export async function exportToExcel<T>(spec: ExportTableSpec<T>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = spec.generatedBy || "Seva Maintenance Management System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(spec.title.slice(0, 31) || "Report");

  // Title & Metadata
  worksheet.mergeCells("A1:F1");
  const titleCell = worksheet.getCell("A1");
  titleCell.value = `${spec.orgName ? `${spec.orgName} - ` : ""}${spec.title}`;
  titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF4F46E5" } };
  titleCell.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 28;

  let currentRow = 2;
  if (spec.dateRange) {
    worksheet.getCell(`A${currentRow}`).value = `Date Range: ${spec.dateRange.from} to ${spec.dateRange.to}`;
    worksheet.getCell(`A${currentRow}`).font = { italic: true, size: 10, color: { argb: "FF64748B" } };
    currentRow++;
  }
  if (spec.generatedAt) {
    worksheet.getCell(`A${currentRow}`).value = `Generated: ${spec.generatedAt}`;
    worksheet.getCell(`A${currentRow}`).font = { italic: true, size: 9, color: { argb: "FF94A3B8" } };
    currentRow++;
  }

  currentRow++; // blank space

  // Table Columns
  const headerRowIndex = currentRow;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 24;

  spec.columns.forEach((col, idx) => {
    const colNumber = idx + 1;
    const cell = headerRow.getCell(colNumber);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF4F46E5" },
    };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "medium" },
      right: { style: "thin" },
    };

    const colDef = worksheet.getColumn(colNumber);
    colDef.width = col.width || Math.max(col.header.length + 4, 15);
  });

  currentRow++;

  // Data Rows
  for (const row of spec.data) {
    const dataRow = worksheet.getRow(currentRow);
    dataRow.height = 20;

    spec.columns.forEach((col, idx) => {
      const colNumber = idx + 1;
      const cell = dataRow.getCell(colNumber);
      let val = col.format ? col.format(row) : (row as any)[col.key];
      if (val !== undefined && val !== null) {
        if (typeof val === "string" && /^[=+\-@\t\r]/.test(val)) {
          val = `'${val}`;
        }
        cell.value = val;
      } else {
        cell.value = "";
      }
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    currentRow++;
  }

  // Summary Metrics Section
  if (spec.summary) {
    currentRow += 2;
    worksheet.getCell(`A${currentRow}`).value = "Summary Metrics";
    worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 11 };
    currentRow++;

    for (const [key, val] of Object.entries(spec.summary)) {
      worksheet.getCell(`A${currentRow}`).value = key;
      worksheet.getCell(`B${currentRow}`).value = val;
      worksheet.getCell(`A${currentRow}`).font = { bold: true };
      currentRow++;
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
