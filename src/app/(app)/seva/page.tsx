"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Table as TableIcon,
  FolderTree,
  Calendar as CalendarIcon,
  Kanban,
  Plus,
  Download,
  Filter,
  Layers,
  ChevronRight,
  Eye,
} from "lucide-react";
import { DataTable, Column } from "@/core/ui-kit/DataTable";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { TreeView, TreeNodeData } from "@/core/ui-kit/TreeView";
import { FilterBar } from "@/core/ui-kit/FilterBar";
import { SevaFormModal } from "@/modules/seva/components/SevaFormModal";
import { format } from "date-fns";

export default function SevaSheetPage() {
  const [viewMode, setViewMode] = useState<"table" | "tree" | "calendar" | "board">("table");
  const [sevas, setSevas] = useState<any[]>([]);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.data?.map((c: any) => ({ label: c.name, value: c.id })) || []))
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data?.map((a: any) => ({ label: a.name, value: a.id })) || []))
      .catch(() => {});
  }, []);

  const loadSevas = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (searchQuery) params.set("q", searchQuery);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedArea) params.set("areaId", selectedArea);
      if (selectedPriority) params.set("priority", selectedPriority);

      const res = await fetch(`/api/v1/seva?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setSevas(json.data || []);
        setTotal(json.meta?.total || 0);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const loadTree = async () => {
    try {
      const res = await fetch("/api/v1/seva/tree");
      if (res.ok) {
        const json = await res.json();
        const mapToNode = (item: any): TreeNodeData => ({
          id: item.id,
          label: `${item.code}: ${item.title}`,
          subLabel: `${item.category.name} • ${item.priority}`,
          isLeaf: !item.isGroup,
          children: item.children ? item.children.map(mapToNode) : [],
        });
        setTreeData(json.data.map(mapToNode));
      }
    } catch {}
  };

  useEffect(() => {
    loadSevas();
    if (viewMode === "tree") {
      loadTree();
    }
  }, [page, searchQuery, selectedCategory, selectedArea, selectedPriority, viewMode]);

  const columns: Column<any>[] = [
    {
      key: "code",
      header: "Code",
      sortable: true,
      width: "110px",
      render: (s) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{s.code}</span>
      ),
    },
    {
      key: "title",
      header: "Title & Scope",
      sortable: true,
      render: (s) => (
        <div>
          <Link href={`/seva/${s.id}`} className="font-semibold text-slate-900 dark:text-slate-100 hover:underline">
            {s.title}
          </Link>
          {s.isGroup && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">
              Group Container
            </span>
          )}
          <div className="text-xs text-slate-500 line-clamp-1">{s.description}</div>
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (s) => <span>{s.category?.name}</span>,
    },
    {
      key: "area",
      header: "Location",
      render: (s) => <span>{s.area?.name}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      render: (s) => {
        const variant =
          s.priority === "URGENT"
            ? "danger"
            : s.priority === "HIGH"
            ? "warning"
            : s.priority === "MEDIUM"
            ? "info"
            : "neutral";
        return <Badge variant={variant} size="sm">{s.priority}</Badge>;
      },
    },
    {
      key: "assignees",
      header: "Assignees",
      render: (s) => (
        <div className="flex -space-x-1.5 overflow-hidden">
          {s.assignees && s.assignees.length > 0 ? (
            s.assignees.map((a: any) => (
              <div
                key={a.id}
                title={a.user?.name}
                className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-white dark:border-slate-800 flex items-center justify-center text-[10px] font-bold"
              >
                {a.user?.name?.charAt(0)}
              </div>
            ))
          ) : (
            <span className="text-xs text-slate-400">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (s) => (
        <Link
          href={`/seva/${s.id}`}
          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 inline-block"
        >
          <Eye className="w-4 h-4" />
        </Link>
      ),
    },
  ];

  const [isExporting, setIsExporting] = useState(false);

  const handleCsvExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format: "csv" });
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedArea) params.set("areaId", selectedArea);
      if (selectedPriority) params.set("priority", selectedPriority);
      if (searchQuery) params.set("q", searchQuery);

      const res = await fetch(`/api/v1/reports/export?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `seva-report-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Direct navigation fallback if blob download fails
      const params = new URLSearchParams({ format: "csv" });
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedArea) params.set("areaId", selectedArea);
      if (selectedPriority) params.set("priority", selectedPriority);
      if (searchQuery) params.set("q", searchQuery);
      window.open(`/api/v1/reports/export?${params.toString()}`, "_blank");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Seva Management Sheet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize, monitor and inspect community maintenance tasks across all views
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "table" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
              }`}
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("tree")}
              title="Tree View"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "tree" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
              }`}
            >
              <FolderTree className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("board")}
              title="Kanban Board View"
              className={`p-1.5 rounded-md transition-all ${
                viewMode === "board" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-500"
              }`}
            >
              <Kanban className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCsvExport}
            isLoading={isExporting}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export CSV
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsFormOpen(true)} icon={<Plus className="w-4 h-4" />}>
            New Seva
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        areas={areas}
        selectedArea={selectedArea}
        onAreaChange={setSelectedArea}
        onReset={() => {
          setSearchQuery("");
          setSelectedCategory("");
          setSelectedArea("");
          setSelectedPriority("");
        }}
      />

      {/* Main View Display */}
      {viewMode === "table" && (
        <DataTable
          columns={columns}
          data={sevas}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange: setPage,
          }}
          renderMobileCard={(s) => (
            <Link href={`/seva/${s.id}`} className="block space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">{s.code}</span>
                <Badge size="sm" variant={s.priority === "URGENT" ? "danger" : s.priority === "HIGH" ? "warning" : "info"}>
                  {s.priority}
                </Badge>
              </div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{s.title}</div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>{s.category?.name} • {s.area?.name}</span>
                {s.isGroup && <span className="text-purple-600 font-semibold">Group Container</span>}
              </div>
            </Link>
          )}
        />
      )}

      {viewMode === "tree" && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Hierarchical Project Tree
          </h2>
          {treeData.length > 0 ? (
            <TreeView
              nodes={treeData}
              onSelectNode={(node) => {
                // Navigate to selected node detail
                const id = node.id;
                window.location.href = `/seva/${id}`;
              }}
            />
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">No project hierarchy found</p>
          )}
        </div>
      )}

      {viewMode === "board" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {["Pending", "In Progress", "Needs Verification", "Done"].map((colTitle) => (
            <div
              key={colTitle}
              className="p-3 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 min-h-[400px]"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {colTitle}
                </span>
              </div>

              <div className="space-y-2">
                {sevas.slice(0, 4).map((s) => (
                  <Link
                    key={s.id}
                    href={`/seva/${s.id}`}
                    className="block p-3 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-400 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-bold text-indigo-600">{s.code}</span>
                      <Badge size="sm" variant={s.priority === "URGENT" ? "danger" : "neutral"}>
                        {s.priority}
                      </Badge>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-2 flex items-center justify-between">
                      <span>{s.category?.name}</span>
                      <span>{s.area?.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Seva Form Modal */}
      <SevaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadSevas}
      />
    </div>
  );
}
