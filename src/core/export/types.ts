export interface ColumnSpec<T = any> {
  header: string;
  key: string;
  format?: (row: T) => string | number | null | undefined;
  width?: number;
}

export interface ExportTableSpec<T = any> {
  title: string;
  orgName?: string;
  dateRange?: { from: string; to: string };
  generatedBy?: string;
  generatedAt?: string;
  columns: ColumnSpec<T>[];
  data: T[];
  summary?: Record<string, string | number>;
}
