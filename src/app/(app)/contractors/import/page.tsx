"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  ChevronRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  XCircle,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { useCurrentUser } from "@/core/auth/useCurrentUser";

export default function ContractorImportPage() {
  const router = useRouter();
  const { hasPermission } = useCurrentUser();
  const canImport = hasPermission("contractors.import");

  const [file, setFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [csvContent, setCsvContent] = useState<string>("");
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setCsvContent(evt.target?.result as string);
    };
    reader.readAsText(selected);
  };

  const handlePreview = async () => {
    if (!csvContent) return;
    setIsLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/contractors/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error?.message || "Failed to parse CSV file.");
        return;
      }
      const j = await res.json();
      setPreviewResult(j.data);
    } catch {
      setError("Network error parsing CSV.");
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!csvContent) return;
    setIsCommitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/contractors/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, updateExisting }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error?.message || "Import commit failed.");
        return;
      }
      const j = await res.json();
      alert(`Successfully imported ${j.data.createdCount} contractors and updated ${j.data.updatedCount}.`);
      router.push("/contractors");
    } catch {
      setError("Network error committing import.");
    } finally {
      setIsCommitting(false);
    }
  };

  if (!canImport) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Administrators with import permissions can execute bulk CSV uploads.
        </p>
        <Link href="/contractors">
          <Button variant="secondary">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/contractors" className="hover:underline">
          Contractors
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">CSV Import</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-indigo-600" /> Bulk Contractor CSV Import
          </h1>
          <p className="text-xs text-slate-500">
            Upload and bulk-onboard contractor records, ABN numbers, contacts, and trade specializations.
          </p>
        </div>

        <a href="/api/v1/contractors/import/template" download="contractors_template.csv">
          <Button variant="secondary" size="sm" className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download CSV Template
          </Button>
        </a>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Upload Box */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-3">
          <Upload className="w-8 h-8 text-indigo-500 mx-auto" />
          <div className="text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Select or drop your CSV file here
            </span>
            <p className="text-slate-400 mt-0.5">Maximum size 2MB, up to 2,000 records</p>
          </div>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="text-xs mx-auto block"
          />
        </div>

        {file && (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              Update matched records (by ABN / Registration Number)
            </label>

            <Button
              size="sm"
              disabled={isLoadingPreview}
              onClick={handlePreview}
              className="gap-1.5"
            >
              {isLoadingPreview ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Validating CSV...
                </>
              ) : (
                "Preview & Validate"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {previewResult && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Validation Summary
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs mt-1">
                <span>Total Rows: <strong>{previewResult.totalRows}</strong></span>
                <span className="text-emerald-600">Valid: <strong>{previewResult.validCount}</strong></span>
                <span className="text-rose-500">Errors: <strong>{previewResult.invalidCount}</strong></span>
                <span className="text-amber-500">Duplicates: <strong>{previewResult.duplicateCount}</strong></span>
              </div>
            </div>

            <Button
              size="sm"
              disabled={isCommitting || previewResult.invalidCount > 0}
              onClick={handleCommit}
              className="gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Commit All ({previewResult.validCount}) Records
            </Button>
          </div>

          {previewResult.invalidCount > 0 && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
              There are {previewResult.invalidCount} rows with validation errors. Imports are strictly all-or-nothing transactions; please correct the errors in your CSV file before importing.
            </div>
          )}

          {/* Rows Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Row</th>
                    <th className="py-2.5 px-3">Company Name</th>
                    <th className="py-2.5 px-3">Reg # / ABN</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Notes / Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewResult.rows?.map((row: any) => (
                    <tr
                      key={row.rowIndex}
                      className={
                        row.errors?.length > 0
                          ? "bg-rose-50/40 dark:bg-rose-950/20"
                          : row.isDuplicate
                          ? "bg-amber-50/30 dark:bg-amber-950/10"
                          : ""
                      }
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {row.rowIndex}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {row.data?.companyName || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400">
                        {row.data?.registrationNumber || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {row.data?.mainPhone || "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        {row.errors?.length > 0 ? (
                          <Badge size="sm" variant="danger">Invalid</Badge>
                        ) : row.isDuplicate ? (
                          <Badge size="sm" variant="warning">Duplicate</Badge>
                        ) : (
                          <Badge size="sm" variant="success">Valid</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px]">
                        {row.errors?.length > 0 ? (
                          <span className="text-rose-600 font-medium">
                            {row.errors.join("; ")}
                          </span>
                        ) : row.isDuplicate ? (
                          <span className="text-amber-600">
                            Matches existing record ({row.duplicateReason})
                          </span>
                        ) : (
                          <span className="text-emerald-600">Ready to import</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
