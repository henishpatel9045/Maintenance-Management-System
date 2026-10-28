"use client";

import React, { useState, useEffect } from "react";
import {
  FileBarChart2,
  Download,
  Filter,
  Calendar,
  Layers,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { StatCard } from "@/core/ui-kit/StatCard";
import { DataTable, Column } from "@/core/ui-kit/DataTable";
import { Badge } from "@/core/ui-kit/Badge";
import { FormField, selectClass, inputClass } from "@/core/ui-kit/FormField";

export default function ReportsPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rootSevaId, setRootSevaId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

  const [previewData, setPreviewData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.data || []))
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data || []))
      .catch(() => {});

    fetch("/api/v1/seva?isGroup=true")
      .then((r) => r.json())
      .then((j) => setProjects(j.data || []))
      .catch(() => {});
  }, []);

  const handleGeneratePreview = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from || undefined,
          to: to || undefined,
          rootSevaId: rootSevaId || undefined,
          categoryId: categoryId || undefined,
          areaId: areaId || undefined,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setPreviewData(json.data);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    handleGeneratePreview();
  }, []);

  const handleExport = async (format: "pdf" | "xlsx" | "csv") => {
    setIsExporting(format);
    try {
      const res = await fetch("/api/v1/reports/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          from: from || undefined,
          to: to || undefined,
          rootSevaId: rootSevaId || undefined,
          categoryId: categoryId || undefined,
          areaId: areaId || undefined,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `seva-report.${format}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch {
    } finally {
      setIsExporting(null);
    }
  };

  const columns: Column<any>[] = [
    { key: "code", header: "Code", width: "100px" },
    { key: "title", header: "Task Title" },
    { key: "category", header: "Category" },
    { key: "area", header: "Area" },
    { key: "dueDate", header: "Due Date" },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <Badge size="sm" variant={r.status === "DONE" ? "success" : r.status === "IN_PROGRESS" ? "info" : "warning"}>
          {r.status}
        </Badge>
      ),
    },
    { key: "assignees", header: "Assignees" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileBarChart2 className="w-6 h-6 text-indigo-600" /> Maintenance & Project Reports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Audit compliance, task performance, and export detailed reports in PDF, Excel, and CSV formats
          </p>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport("csv")}
            isLoading={isExporting === "csv"}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            CSV
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport("xlsx")}
            isLoading={isExporting === "xlsx"}
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />}
          >
            Excel
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => handleExport("pdf")}
            isLoading={isExporting === "pdf"}
            icon={<FileText className="w-3.5 h-3.5" />}
          >
            PDF Report
          </Button>
        </div>
      </div>

      {/* Filter Parameters */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <FormField label="From Date">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </FormField>

          <FormField label="To Date">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </FormField>

          <FormField label="Project Scope">
            <select value={rootSevaId} onChange={(e) => setRootSevaId(e.target.value)} className={selectClass}>
              <option value="">All Projects & Seva</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}: {p.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Area / Location">
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={selectClass}>
              <option value="">All Locations</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="flex justify-end mt-3">
          <Button size="sm" variant="secondary" onClick={handleGeneratePreview} isLoading={isLoading}>
            Generate Preview
          </Button>
        </div>
      </div>

      {/* KPI Metrics Summary Strip */}
      {previewData?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Jobs" value={previewData.metrics.total} color="indigo" />
          <StatCard label="Completed" value={previewData.metrics.done} color="emerald" subValue={`${previewData.metrics.completionPercent}%`} />
          <StatCard label="In Progress" value={previewData.metrics.inProgress} color="sky" />
          <StatCard label="Overdue" value={previewData.metrics.overdue} color="rose" />
          <StatCard label="On-Time Rate" value={`${previewData.metrics.onTimePercent}%`} color="emerald" />
          <StatCard label="Total Spend" value={`$${previewData.metrics.totalSpend}`} color="indigo" />
        </div>
      )}

      {/* Detailed Report Table Preview */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Report Data Preview ({previewData?.detailRows?.length || 0} occurrences)
        </h2>

        <DataTable
          columns={columns}
          data={previewData?.detailRows || []}
          keyExtractor={(r) => r.id}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
