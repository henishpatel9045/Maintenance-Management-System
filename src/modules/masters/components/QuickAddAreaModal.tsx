"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, MapPin } from "lucide-react";
import { Modal } from "@/core/ui-kit/Modal";
import { Button } from "@/core/ui-kit/Button";
import { FormField, inputClass, selectClass } from "@/core/ui-kit/FormField";
import { AreaItem, buildAreaPath } from "../utils";

export interface QuickAddAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAreas: AreaItem[];
  onAreaCreated: (newArea: AreaItem) => void;
}

export function QuickAddAreaModal({
  isOpen,
  onClose,
  existingAreas,
  onAreaCreated,
}: QuickAddAreaModalProps) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areasMap = React.useMemo(() => {
    const map = new Map<string, AreaItem>();
    existingAreas.forEach((a) => map.set(a.id, a));
    return map;
  }, [existingAreas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please provide an area name");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/masters/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          parentId: parentId || null,
          sortOrder,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message || "Failed to create area");
      }

      const created: AreaItem = json.data;
      onAreaCreated(created);
      setName("");
      setParentId("");
      setSortOrder(0);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not create area");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Add Area / Location" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-xs text-indigo-800 dark:text-indigo-200 flex items-center gap-2">
          <MapPin className="w-4 h-4 shrink-0 text-indigo-500" />
          <span>Add a new campus area on the fly. It will be immediately selected for this Seva.</span>
        </div>

        <FormField label="Area Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Garden Pavilion, Solar Shed, Storage Room B..."
            className={inputClass}
            autoFocus
            required
            maxLength={150}
          />
        </FormField>

        <FormField label="Parent Facility (Optional)">
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className={selectClass}
          >
            <option value="">None (Top-Level Complex/Facility)</option>
            {existingAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {buildAreaPath(a.id, areasMap)}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Sort Order">
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
            className={inputClass}
            min={0}
            max={9999}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          >
            Add & Select Area
          </Button>
        </div>
      </form>
    </Modal>
  );
}
