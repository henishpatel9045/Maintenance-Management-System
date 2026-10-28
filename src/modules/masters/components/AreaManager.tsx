"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  FolderTree,
  List,
  ChevronRight,
  ChevronDown,
  Building2,
  Home,
  Layers,
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField, inputClass, selectClass } from "@/core/ui-kit/FormField";
import { AreaItem, buildAreaPath, getAreaDescendantIds } from "../utils";

interface AreaNode extends AreaItem {
  children: AreaNode[];
}

export function AreaManager({
  onAreaListChange,
}: {
  onAreaListChange?: (areas: AreaItem[]) => void;
}) {
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingArea, setEditingArea] = useState<AreaItem | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [areaToDelete, setAreaToDelete] = useState<AreaItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const loadAreas = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/masters/areas");
      if (res.ok) {
        const json = await res.json();
        const loaded: AreaItem[] = json.data || [];
        setAreas(loaded);
        onAreaListChange?.(loaded);
      } else {
        showToast("Failed to load areas list", "error");
      }
    } catch {
      showToast("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  }, [onAreaListChange]);

  useEffect(() => {
    loadAreas();
  }, [loadAreas]);

  // Map of areas for quick lookup & path resolution
  const areasMap = useMemo(() => {
    const map = new Map<string, AreaItem>();
    areas.forEach((a) => map.set(a.id, a));
    return map;
  }, [areas]);

  // Tree representation
  const areaTree = useMemo(() => {
    const nodeMap = new Map<string, AreaNode>();
    areas.forEach((a) => {
      nodeMap.set(a.id, { ...a, children: [] });
    });

    const roots: AreaNode[] = [];
    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort nodes by sortOrder then name
    const sortNodes = (nodes: AreaNode[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      nodes.forEach((n) => {
        if (n.children.length > 0) sortNodes(n.children);
      });
    };
    sortNodes(roots);

    return roots;
  }, [areas]);

  // Filtered areas for search
  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const q = searchQuery.toLowerCase();
    return areas.filter((a) => {
      const fullPath = buildAreaPath(a.id, areasMap).toLowerCase();
      return a.name.toLowerCase().includes(q) || fullPath.includes(q);
    });
  }, [areas, searchQuery, areasMap]);

  // Statistics
  const stats = useMemo(() => {
    const total = areas.length;
    const topLevel = areas.filter((a) => !a.parentId).length;
    const subAreas = total - topLevel;
    const inUse = areas.filter(
      (a) => (a._count?.sevas ?? 0) > 0 || (a._count?.sevaRequests ?? 0) > 0
    ).length;
    return { total, topLevel, subAreas, inUse };
  }, [areas]);

  // Disallowed parent IDs when editing (self and all descendants to prevent circular trees)
  const invalidParentIds = useMemo(() => {
    if (!editingArea) return new Set<string>();
    const descendants = getAreaDescendantIds(editingArea.id, areas);
    descendants.add(editingArea.id);
    return descendants;
  }, [editingArea, areas]);

  const handleOpenCreate = (parentId?: string) => {
    setModalMode("create");
    setEditingArea(null);
    setFormName("");
    setFormParentId(parentId || "");
    // Default sortOrder to highest sort order under same parent + 1
    const siblings = areas.filter((a) => (parentId ? a.parentId === parentId : !a.parentId));
    const nextOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 1;
    setFormSortOrder(nextOrder);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (area: AreaItem) => {
    setModalMode("edit");
    setEditingArea(area);
    setFormName(area.name);
    setFormParentId(area.parentId || "");
    setFormSortOrder(area.sortOrder);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveArea = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName) {
      setFormError("Area name cannot be empty");
      return;
    }

    setIsSubmitting(true);
    try {
      if (modalMode === "create") {
        const res = await fetch("/api/v1/masters/areas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            parentId: formParentId || null,
            sortOrder: formSortOrder,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || "Failed to create area");
        }
        showToast(`Area "${trimmedName}" created successfully!`);
      } else if (editingArea) {
        const res = await fetch(`/api/v1/masters/areas/${editingArea.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: trimmedName,
            parentId: formParentId || null,
            sortOrder: formSortOrder,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.message || "Failed to update area");
        }
        showToast(`Area "${trimmedName}" updated successfully!`);
      }

      setIsModalOpen(false);
      await loadAreas();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDelete = (area: AreaItem) => {
    setAreaToDelete(area);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!areaToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/masters/areas/${areaToDelete.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to delete area");
      }
      showToast(`Area "${areaToDelete.name}" was removed.`);
      setIsDeleteOpen(false);
      setAreaToDelete(null);
      await loadAreas();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Could not delete area", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all transform animate-in slide-in-from-bottom-5 ${
            toast.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
              : "bg-red-50 dark:bg-red-950/80 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Dynamic Areas & Locations
                <Badge variant="neutral" size="sm">
                  {areas.length} configured
                </Badge>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Coordinators & Administrators can add new campus zones, floors, rooms, or remove obsolete areas
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAreas}
            isLoading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            title="Refresh list"
          >
            Refresh
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => handleOpenCreate()}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Area
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Areas</span>
            <MapPin className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total}</div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Top Complexes</span>
            <Building2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.topLevel}</div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Rooms & Sub-areas</span>
            <Home className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.subAreas}</div>
        </div>

        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Active with Seva</span>
            <Layers className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.inUse}</div>
        </div>
      </div>

      {/* Filter & View Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search areas by name or hierarchy..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "tree"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            Tree View
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              viewMode === "table"
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Table View
          </button>
        </div>
      </div>

      {/* Main Content: Tree View or Table View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden p-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Loading campus areas...</p>
          </div>
        ) : areas.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-full text-indigo-600 dark:text-indigo-400">
              <MapPin className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No Areas Configured</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Get started by creating your first campus facility, floor, or room.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={() => handleOpenCreate()} icon={<Plus className="w-3.5 h-3.5" />}>
              Create First Area
            </Button>
          </div>
        ) : viewMode === "tree" ? (
          <div className="space-y-1">
            {areaTree.map((rootNode) => (
              <AreaTreeNodeItem
                key={rootNode.id}
                node={rootNode}
                level={0}
                searchQuery={searchQuery}
                onAddChild={(parentId) => handleOpenCreate(parentId)}
                onEdit={(area) => handleOpenEdit(area)}
                onDelete={(area) => handleOpenDelete(area)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Area Name</th>
                  <th className="py-2.5 px-3">Full Hierarchy Path</th>
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Sub-areas</th>
                  <th className="py-2.5 px-3">Linked Tasks</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredAreas.map((area) => {
                  const fullPath = buildAreaPath(area.id, areasMap);
                  const childCount = area._count?.children ?? 0;
                  const sevaCount = area._count?.sevas ?? 0;
                  const reqCount = area._count?.sevaRequests ?? 0;
                  const totalLinked = sevaCount + reqCount;

                  return (
                    <tr
                      key={area.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>{area.name}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {fullPath}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        <Badge size="sm" variant="neutral">
                          #{area.sortOrder}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {childCount > 0 ? (
                          <Badge size="sm" variant="info">
                            {childCount} sub-area{childCount > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {totalLinked > 0 ? (
                          <Badge size="sm" variant="warning">
                            {totalLinked} record{totalLinked > 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">None (safe to delete)</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleOpenCreate(area.id)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600"
                            title="Add sub-area inside this area"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(area)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-blue-600"
                            title="Edit / Rename"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(area)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/60 text-slate-400 hover:text-red-600"
                            title="Delete area"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "Add Dynamic Area / Location" : `Edit Area: ${editingArea?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleSaveArea} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <FormField label="Area / Location Name" required>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Prayer Hall, Dining Hall, First Floor, Gardens..."
              className={inputClass}
              autoFocus
              required
              maxLength={150}
            />
          </FormField>

          <FormField label="Parent Facility / Building (Hierarchy)">
            <select
              value={formParentId}
              onChange={(e) => setFormParentId(e.target.value)}
              className={selectClass}
            >
              <option value="">None — Top-Level Campus Facility</option>
              {areas.map((a) => {
                const isDisabled = invalidParentIds.has(a.id);
                const path = buildAreaPath(a.id, areasMap);
                return (
                  <option key={a.id} value={a.id} disabled={isDisabled}>
                    {path} {isDisabled ? "(Not allowed: self or descendant)" : ""}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Select a parent complex to organize areas in a clean nested structure (e.g. Main Complex → Ground Floor → Room)
            </p>
          </FormField>

          <FormField label="Sort Order Index">
            <input
              type="number"
              value={formSortOrder}
              onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
              className={inputClass}
              min={0}
              max={9999}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Controls display sequence in dropdowns and dashboards (lower numbers display first)
            </p>
          </FormField>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {modalMode === "create" ? "Create Area" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Area"
        maxWidth="sm"
      >
        {areaToDelete && (
          <div className="space-y-4">
            {/* Warning if blocked */}
            {(areaToDelete._count?.children ?? 0) > 0 ||
            (areaToDelete._count?.sevas ?? 0) > 0 ||
            (areaToDelete._count?.sevaRequests ?? 0) > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 rounded-xl text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-sm">Cannot Delete Area Currently</span>
                    <p className="mt-1">
                      <strong>&ldquo;{areaToDelete.name}&rdquo;</strong> cannot be removed because it is actively in use:
                    </p>
                    <ul className="list-disc pl-4 mt-1.5 space-y-0.5">
                      {(areaToDelete._count?.children ?? 0) > 0 && (
                        <li>Contains {areaToDelete._count?.children} sub-area(s)</li>
                      )}
                      {(areaToDelete._count?.sevas ?? 0) > 0 && (
                        <li>Referenced by {areaToDelete._count?.sevas} active Seva task(s)</li>
                      )}
                      {(areaToDelete._count?.sevaRequests ?? 0) > 0 && (
                        <li>Referenced by {areaToDelete._count?.sevaRequests} Seva request(s)</li>
                      )}
                    </ul>
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                      Please reassign or delete the associated sub-areas and tasks before removing this area.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setIsDeleteOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>
                      Are you sure you want to delete the area <strong>&ldquo;{areaToDelete.name}&rdquo;</strong>?
                    </p>
                    <p className="mt-1 text-slate-500">
                      This area has no associated child rooms or tasks and will be permanently removed.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsDeleteOpen(false)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={handleConfirmDelete}
                    isLoading={isDeleting}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Confirm Delete
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// Tree Node Item Component for visual hierarchy
function AreaTreeNodeItem({
  node,
  level,
  searchQuery,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: AreaNode;
  level: number;
  searchQuery: string;
  onAddChild: (parentId: string) => void;
  onEdit: (area: AreaItem) => void;
  onDelete: (area: AreaItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const childCount = node._count?.children ?? node.children.length;
  const sevaCount = node._count?.sevas ?? 0;
  const reqCount = node._count?.sevaRequests ?? 0;
  const totalTasks = sevaCount + reqCount;

  const matchesSearch =
    !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className={`space-y-1 ${!matchesSearch && !hasChildren ? "opacity-40" : ""}`}>
      <div
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        className="group flex items-center justify-between py-2 pr-3 rounded-lg hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-xs transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700/60"
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          {level === 0 ? (
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          ) : level === 1 ? (
            <Home className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          )}

          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{node.name}</span>

          <span className="text-[10px] text-slate-400 font-mono">#{node.sortOrder}</span>

          {childCount > 0 && (
            <Badge size="sm" variant="neutral">
              {childCount} {childCount === 1 ? "room" : "rooms"}
            </Badge>
          )}

          {totalTasks > 0 && (
            <Badge size="sm" variant="info">
              {totalTasks} {totalTasks === 1 ? "task" : "tasks"}
            </Badge>
          )}
        </div>

        {/* Actions visible on hover or focus */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
            title="Add sub-room inside this area"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Add Sub-area</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit(node)}
            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            title="Edit / Rename"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(node)}
            className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
            title="Delete area"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="relative pl-3 border-l border-slate-200 dark:border-slate-800 ml-3 space-y-1">
          {node.children.map((child) => (
            <AreaTreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              searchQuery={searchQuery}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
