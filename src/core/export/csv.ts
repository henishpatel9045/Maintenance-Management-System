import { ExportTableSpec } from "./types";

export function neutralizeFormula<T>(value: T): T {
  if (value === null || value === undefined) return value;
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}` as unknown as T;
  }
  return value;
}

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T>(spec: ExportTableSpec<T>): string {
  const lines: string[] = [];

  // Metadata headers
  if (spec.orgName) {
    lines.push(`Organisation,${escapeCsvCell(spec.orgName)}`);
  }
  lines.push(`Report,${escapeCsvCell(spec.title)}`);
  if (spec.dateRange) {
    lines.push(`Date Range,${escapeCsvCell(`${spec.dateRange.from} to ${spec.dateRange.to}`)}`);
  }
  if (spec.generatedAt) {
    lines.push(`Generated At,${escapeCsvCell(spec.generatedAt)}`);
  }
  lines.push(""); // blank separator

  // Column Headers
  const headers = spec.columns.map((c) => escapeCsvCell(c.header)).join(",");
  lines.push(headers);

  // Data rows
  for (const row of spec.data) {
    const rowValues = spec.columns.map((col) => {
      const val = col.format ? col.format(row) : (row as any)[col.key];
      return escapeCsvCell(val);
    });
    lines.push(rowValues.join(","));
  }

  // Summary row if present
  if (spec.summary) {
    lines.push("");
    lines.push("Summary Metrics");
    for (const [k, v] of Object.entries(spec.summary)) {
      lines.push(`${escapeCsvCell(k)},${escapeCsvCell(v)}`);
    }
  }

  return lines.join("\r\n");
}
