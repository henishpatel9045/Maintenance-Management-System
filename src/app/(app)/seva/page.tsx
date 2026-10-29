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
  Archive,
  Trash2,
  RotateCcw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  X,
  FileArchive,
} from "lucide-react";
import { DataTable, Column } from "@/core/ui-kit/DataTable";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { TreeView, TreeNodeData } from "@/core/ui-kit/TreeView";
import { FilterBar } from "@/core/ui-kit/FilterBar";
import { SevaFormModal } from "@/modules/seva/components/SevaFormModal";
import { format } from "date-fns";

export default function SevaSheetPage() {
  const [viewMode, setViewMode] = useState<"table" | "tree" | "calendar" | "board">("table");
  const [activeSection, setActiveSection] = useState<"active" | "archived">("active");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [sevas, setSevas] = useState<any[]>([]);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Bulk actions state
  const [selectedSevaIds, setSelectedSevaIds] = useState<Set<string>>(new Set());
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPerformingBulkAction, setIsPerformingBulkAction] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [purgeNotification, setPurgeNotification] = useState<string | null>(null);

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

  // Load user
  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((j) => setCurrentUser(j.data?.user || j.data))
      .catch(() => {});
  }, []);

  const canManageSeva =
    currentUser?.role === "ADMIN" || currentUser?.role === "COORDINATOR";

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
      if (activeSection === "archived") params.set("isArchived", "true");
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
  }, [page, searchQuery, selectedCategory, selectedArea, selectedPriority, viewMode, activeSection]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedSevaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const allSelected = sevas.length > 0 && sevas.every((s) => selectedSevaIds.has(s.id));
    if (allSelected) {
      setSelectedSevaIds(new Set());
    } else {
      setSelectedSevaIds(new Set(sevas.map((s) => s.id)));
    }
  };

  const handleBulkDownload = async (ids?: string[]) => {
    const targetIds = ids || Array.from(selectedSevaIds);
    if (targetIds.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const url = `/api/v1/seva/bulk-files.zip?ids=${targetIds.join(",")}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message || "Failed to download assets");
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `seva-assets-bulk-${format(new Date(), "yyyyMMdd-HHmmss")}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
      window.open(`/api/v1/seva/bulk-files.zip?ids=${targetIds.join(",")}`, "_blank");
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleBulkArchive = async (withDownloadAndPurge: boolean) => {
    const sevaIds = Array.from(selectedSevaIds);
    if (sevaIds.length === 0) return;
    setIsPerformingBulkAction(true);

    try {
      if (withDownloadAndPurge) {
        // First download the ZIP archive of all assets
        await handleBulkDownload(sevaIds);
      }

      // Call bulk archive API
      const res = await fetch("/api/v1/seva/bulk-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sevaIds,
          scheduleFilePurge: withDownloadAndPurge,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message || "Failed to archive sevas");
        return;
      }

      const json = await res.json();
      setIsArchiveModalOpen(false);
      setSelectedSevaIds(new Set());
      loadSevas();

      if (withDownloadAndPurge) {
        setPurgeNotification(
          `Archive completed! A combined ZIP of all assets was downloaded. In accordance with your selection, these files will be automatically purged from the server in 24 hours to reclaim disk space.`
        );
      } else {
        setPurgeNotification(`Successfully archived ${json.archivedCount} Seva(s).`);
      }
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred while archiving");
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleBulkDelete = async () => {
    const sevaIds = Array.from(selectedSevaIds);
    if (sevaIds.length === 0) return;
    setIsPerformingBulkAction(true);

    try {
      const res = await fetch("/api/v1/seva/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sevaIds }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message || "Failed to delete sevas");
        return;
      }

      const json = await res.json();
      setIsDeleteModalOpen(false);
      setSelectedSevaIds(new Set());
      loadSevas();
      setPurgeNotification(`Permanently deleted ${json.deletedCount} Seva(s).`);
    } catch (e) {
      console.error(e);
      alert("An unexpected error occurred while deleting");
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const handleBulkUnarchive = async () => {
    const sevaIds = Array.from(selectedSevaIds);
    if (sevaIds.length === 0) return;
    setIsPerformingBulkAction(true);

    try {
      const res = await fetch("/api/v1/seva/bulk-unarchive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sevaIds }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error?.message || "Failed to unarchive sevas");
        return;
      }

      const json = await res.json();
      setSelectedSevaIds(new Set());
      loadSevas();
      setPurgeNotification(`Restored ${json.unarchivedCount} Seva(s) back to active.`);
    } catch (e) {
      console.error(e);
      alert("An error occurred while unarchiving");
    } finally {
      setIsPerformingBulkAction(false);
    }
  };

  const columns: Column<any>[] = [
    ...(canManageSeva
      ? [
          {
            key: "select",
            header: (
              <input
                type="checkbox"
                aria-label="Select all on page"
                checked={sevas.length > 0 && sevas.every((s) => selectedSevaIds.has(s.id))}
                onChange={handleToggleSelectAll}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            ),
            width: "44px",
            render: (s: any) => (
              <input
                type="checkbox"
                aria-label={`Select seva ${s.code}`}
                checked={selectedSevaIds.has(s.id)}
                onChange={() => handleToggleSelect(s.id)}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            ),
          },
        ]
      : []),
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
          {s.isArchived && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
              Archived
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
      if (activeSection === "archived") params.set("isArchived", "true");
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
      a.download = `seva-report-${activeSection}-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      const params = new URLSearchParams({ format: "csv" });
      if (activeSection === "archived") params.set("isArchived", "true");
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
      {/* 24h Purge or Action Notification Banner */}
      {purgeNotification && (
        <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs text-indigo-950 dark:text-indigo-200 flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="font-medium">{purgeNotification}</span>
          </div>
          <button
            onClick={() => setPurgeNotification(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Seva Management Sheet
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Organize, monitor, bulk-archive and inspect community maintenance tasks across all views
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

          {canManageSeva && activeSection === "active" && (
            <Button variant="primary" size="sm" onClick={() => setIsFormOpen(true)} icon={<Plus className="w-4 h-4" />}>
              New Seva
            </Button>
          )}
        </div>
      </div>

      {/* Section Tabs: Active Sevas vs Archived Items */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveSection("active");
              setSelectedSevaIds(new Set());
              setPage(1);
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === "active"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Active Sevas</span>
          </button>

          {canManageSeva && (
            <button
              onClick={() => {
                setActiveSection("archived");
                setSelectedSevaIds(new Set());
                setPage(1);
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeSection === "archived"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archived Sevas</span>
            </button>
          )}
        </div>

        {activeSection === "archived" && (
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" />
            <span>Archive Repository (Read-only occurrence spawning paused)</span>
          </div>
        )}
      </div>

      {/* Floating / Sticky Bulk Action Bar */}
      {selectedSevaIds.size > 0 && canManageSeva && (
        <div className="p-3 bg-indigo-900 text-white dark:bg-slate-900 dark:border dark:border-indigo-900/60 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-white/20 dark:bg-indigo-950 text-white rounded-lg text-xs font-bold font-mono">
              {selectedSevaIds.size}
            </span>
            <span className="text-xs font-semibold">
              Seva{selectedSevaIds.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => setSelectedSevaIds(new Set())}
              className="text-xs text-indigo-200 hover:text-white underline ml-2"
            >
              Clear Selection
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Download ZIP button */}
            <Button
              size="sm"
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
              onClick={() => handleBulkDownload()}
              isLoading={isDownloadingZip}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Download Assets (ZIP)
            </Button>

            {activeSection === "active" ? (
              <Button
                size="sm"
                variant="outline"
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/30 text-xs"
                onClick={() => setIsArchiveModalOpen(true)}
                icon={<Archive className="w-3.5 h-3.5" />}
              >
                Bulk Archive
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border-emerald-400/30 text-xs"
                onClick={handleBulkUnarchive}
                isLoading={isPerformingBulkAction}
                icon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Bulk Unarchive
              </Button>
            )}

            <Button
              size="sm"
              variant="danger"
              className="text-xs"
              onClick={() => setIsDeleteModalOpen(true)}
              icon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Bulk Delete
            </Button>
          </div>
        </div>
      )}

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
            <div className="flex items-start gap-2">
              {canManageSeva && (
                <input
                  type="checkbox"
                  aria-label={`Select seva ${s.code}`}
                  checked={selectedSevaIds.has(s.id)}
                  onChange={() => handleToggleSelect(s.id)}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              )}
              <Link href={`/seva/${s.id}`} className="block flex-1 space-y-1.5">
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
                  {s.isArchived && <span className="text-amber-600 font-semibold">Archived</span>}
                </div>
              </Link>
            </div>
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

      {/* Bulk Archive Modal */}
      {isArchiveModalOpen && (
        <Modal
          isOpen={isArchiveModalOpen}
          onClose={() => setIsArchiveModalOpen(false)}
          title={`Archive ${selectedSevaIds.size} Seva Record(s)`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-semibold flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <Archive className="w-4 h-4 shrink-0" />
                <span>Archive Confirmation & Asset Management</span>
              </div>
              <p>
                Archiving will pause all recurrence schedules and move these Sevas to the Archived section.
              </p>
              <p className="font-medium">
                Would you like to download all attached files (photos, completion proof, quotes) in a single ZIP file before archiving?
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <span className="font-semibold block text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" /> 24-Hour Server Space Cleanup
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                If you download the asset bundle, the server background worker will schedule permanent deletion of these files from the server in 24 hours to reclaim disk space.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="primary"
                size="sm"
                isLoading={isPerformingBulkAction || isDownloadingZip}
                onClick={() => handleBulkArchive(true)}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Archive & Download Assets (Delete from Server in 24h)
              </Button>
              <Button
                variant="outline"
                size="sm"
                isLoading={isPerformingBulkAction}
                onClick={() => handleBulkArchive(false)}
              >
                Archive Only (Keep Files on Server)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsArchiveModalOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Modal */}
      {isDeleteModalOpen && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title={`Permanently Delete ${selectedSevaIds.size} Seva Record(s)`}
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-700 dark:text-rose-300">
                  Permanent Data Deletion
                </span>
                <span className="mt-0.5 block">
                  This action is immediate and non-reversible. It will permanently remove all selected Seva records, occurrences, task links, file associations, and checklists.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={isPerformingBulkAction}
                onClick={handleBulkDelete}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Permanently Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
