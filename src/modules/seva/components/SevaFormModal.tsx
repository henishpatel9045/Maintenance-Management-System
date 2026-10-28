"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/core/ui-kit/Modal";
import { Button } from "@/core/ui-kit/Button";
import { FormField, inputClass, selectClass, textareaClass } from "@/core/ui-kit/FormField";
import { describeRecurrenceRule, getNextThreeDates } from "../recurrence";
import { Plus, Trash2, Star, Users, Search, Check, Loader2, Award, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { QuickAddAreaModal } from "@/modules/masters/components/QuickAddAreaModal";
import { buildAreaPath, AreaItem } from "@/modules/masters/utils";
import { ConfirmDialog } from "@/core/ui-kit/ConfirmDialog";

export interface SevaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any; // If editing
}

export function SevaFormModal({ isOpen, onClose, onSuccess, initialData }: SevaFormModalProps) {
  const isEditing = Boolean(initialData);

  // Form states
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [kind, setKind] = useState<"ONE_TIME" | "RECURRING">(initialData?.kind || "ONE_TIME");
  const [subKind, setSubKind] = useState<"NEW" | "REPAIR">(initialData?.subKind || "REPAIR");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "");
  const [areaId, setAreaId] = useState(initialData?.areaId || "");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">(initialData?.priority || "MEDIUM");
  const [parentId, setParentId] = useState(initialData?.parentId || "");
  const [startDate, setStartDate] = useState(initialData?.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd") : "");
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? format(new Date(initialData.dueDate), "yyyy-MM-dd") : "");
  const [scheduleMode, setScheduleMode] = useState<"FIXED" | "FLOATING">(initialData?.scheduleMode || "FIXED");
  const [requiresVerification, setRequiresVerification] = useState(initialData?.requiresVerification || false);
  const [estimatedBudget, setEstimatedBudget] = useState(initialData?.estimatedBudget ? String(initialData.estimatedBudget) : "");

  // Assignees
  const [assignees, setAssignees] = useState<Array<{ userId: string; isLead: boolean }>>(
    initialData?.assignees?.map((a: any) => ({ userId: a.userId, isLead: a.isLead })) || []
  );

  // Checklist items
  const [checklist, setChecklist] = useState<Array<{ text: string }>>(
    initialData?.checklistItems?.map((c: any) => ({ text: c.text })) || []
  );
  const [newChecklistText, setNewChecklistText] = useState("");

  // Recurrence rule
  const [frequency, setFrequency] = useState<any>(initialData?.recurrenceRule?.frequency || "MONTHLY");
  const [interval, setInterval] = useState(initialData?.recurrenceRule?.interval || 1);
  const [byWeekday, setByWeekday] = useState<number[]>(initialData?.recurrenceRule?.byWeekday || [1]);
  const [byMonthDay, setByMonthDay] = useState<number[]>(initialData?.recurrenceRule?.byMonthDay || [1]);

  // Options loaded from API
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [treeNodes, setTreeNodes] = useState<any[]>([]);
  const [isQuickAddAreaOpen, setIsQuickAddAreaOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Licences integration
  const [licencesEnabled, setLicencesEnabled] = useState(true);
  const [licenceTypes, setLicenceTypes] = useState<any[]>([]);
  const [licenceDirectoryUsers, setLicenceDirectoryUsers] = useState<any[]>([]);
  const [requiredLicences, setRequiredLicences] = useState<Array<{ licenceTypeId: string; classRequired?: string; minHolders: number }>>([]);
  const [onlyShowEligible, setOnlyShowEligible] = useState(false);
  const [enforcementMode, setEnforcementMode] = useState<"WARN" | "BLOCK">("WARN");
  const [pendingWarningPrompt, setPendingWarningPrompt] = useState<{ message: string; onProceed: () => void } | null>(null);

  // New requirement inputs
  const [selectedReqTypeId, setSelectedReqTypeId] = useState("");
  const [selectedReqClass, setSelectedReqClass] = useState("");
  const [selectedReqMinHolders, setSelectedReqMinHolders] = useState(1);

  const areasMap = React.useMemo(() => {
    const map = new Map<string, AreaItem>();
    areas.forEach((a) => map.set(a.id, a));
    return map;
  }, [areas]);

  const filteredUsers = React.useMemo(() => {
    let result = users;
    if (userSearchQuery.trim()) {
      const q = userSearchQuery.toLowerCase().trim();
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.role?.name?.toLowerCase().includes(q)
      );
    }
    if (onlyShowEligible && requiredLicences.length > 0) {
      result = result.filter((u) => {
        const uRec = licenceDirectoryUsers.find((ld: any) => ld.id === u.id);
        if (!uRec?.licences) return false;
        return requiredLicences.every((req) =>
          uRec.licences.some((l: any) => {
            if (l.licenceTypeId !== req.licenceTypeId) return false;
            if (req.classRequired && l.class !== req.classRequired) return false;
            return l.status === "VALID" || l.status === "EXPIRING_SOON";
          })
        );
      });
    }
    return result;
  }, [users, userSearchQuery, onlyShowEligible, requiredLicences, licenceDirectoryUsers]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Synchronize form state whenever modal opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setKind(initialData.kind || "ONE_TIME");
      setSubKind(initialData.subKind || "REPAIR");
      setCategoryId(initialData.categoryId || "");
      setAreaId(initialData.areaId || "");
      setPriority(initialData.priority || "MEDIUM");
      setParentId(initialData.parentId || "");
      setStartDate(initialData.startDate ? format(new Date(initialData.startDate), "yyyy-MM-dd") : "");
      setDueDate(initialData.dueDate ? format(new Date(initialData.dueDate), "yyyy-MM-dd") : "");
      setScheduleMode(initialData.scheduleMode || "FIXED");
      setRequiresVerification(Boolean(initialData.requiresVerification));
      setEstimatedBudget(initialData.estimatedBudget ? String(initialData.estimatedBudget) : "");
      setAssignees(
        initialData.assignees?.map((a: any) => ({
          userId: a.userId || a.user?.id || a.id,
          isLead: Boolean(a.isLead),
        })) || []
      );
      setChecklist(initialData.checklistItems?.map((c: any) => ({ text: c.text })) || []);
      if (initialData.recurrenceRule) {
        setFrequency(initialData.recurrenceRule.frequency || "MONTHLY");
        setInterval(initialData.recurrenceRule.interval || 1);
        setByWeekday(initialData.recurrenceRule.byWeekday || [1]);
        setByMonthDay(initialData.recurrenceRule.byMonthDay || [1]);
      }
    } else {
      setTitle("");
      setDescription("");
      setKind("ONE_TIME");
      setSubKind("REPAIR");
      setCategoryId("");
      setAreaId("");
      setPriority("MEDIUM");
      setParentId("");
      setStartDate("");
      setDueDate("");
      setScheduleMode("FIXED");
      setRequiresVerification(false);
      setEstimatedBudget("");
      setAssignees([]);
      setChecklist([]);
      setNewChecklistText("");
    }
  }, [isOpen, initialData]);

  // Load masters on modal open
  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => {
        setCategories(j.data || []);
        if (!initialData?.categoryId && j.data?.[0]) {
          setCategoryId(j.data[0].id);
        }
      })
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => {
        setAreas(j.data || []);
        if (!initialData?.areaId && j.data?.[0]) {
          setAreaId(j.data[0].id);
        }
      })
      .catch(() => {});

    setIsLoadingUsers(true);
    fetch("/api/v1/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.data || []))
      .catch(() => {})
      .finally(() => setIsLoadingUsers(false));

    fetch("/api/v1/seva/tree")
      .then((r) => r.json())
      .then((j) => setTreeNodes(j.data || []))
      .catch(() => {});

    // Load licence types and directory
    fetch("/api/v1/licence-types")
      .then((r) => {
        if (r.status === 404) setLicencesEnabled(false);
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (j?.data) {
          setLicenceTypes(j.data);
          if (j.data[0]) setSelectedReqTypeId(j.data[0].id);
        }
      })
      .catch(() => {});

    fetch("/api/v1/licence-directory?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) setLicenceDirectoryUsers(j.data);
      })
      .catch(() => {});

    fetch("/api/v1/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.licenceEnforcement) {
          setEnforcementMode(j.data.licenceEnforcement);
        }
      })
      .catch(() => {});

    if (initialData?.id) {
      fetch(`/api/v1/seva/${initialData.id}/required-licences`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.data) {
            setRequiredLicences(
              j.data.map((r: any) => ({
                licenceTypeId: r.licenceTypeId,
                classRequired: r.classRequired || undefined,
                minHolders: r.minHolders || 1,
              }))
            );
          }
        })
        .catch(() => {});
    } else {
      setRequiredLicences([]);
    }
  }, [isOpen, initialData]);

  // Recurrence preview
  const recurrenceConfig = {
    frequency,
    interval: Number(interval) || 1,
    byWeekday,
    byMonthDay,
    startDate: startDate ? new Date(startDate) : new Date(),
  };

  const recurrencePreview = kind === "RECURRING" ? describeRecurrenceRule(recurrenceConfig) : "";
  const nextThree = kind === "RECURRING" ? getNextThreeDates(recurrenceConfig) : [];

  const addChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklist([...checklist, { text: newChecklistText.trim() }]);
    setNewChecklistText("");
  };

  const removeChecklistItem = (idx: number) => {
    setChecklist(checklist.filter((_, i) => i !== idx));
  };

  const addRequiredLicence = () => {
    if (!selectedReqTypeId) return;
    const exists = requiredLicences.some(
      (r) => r.licenceTypeId === selectedReqTypeId && r.classRequired === (selectedReqClass.trim() || undefined)
    );
    if (exists) return;
    setRequiredLicences([
      ...requiredLicences,
      {
        licenceTypeId: selectedReqTypeId,
        classRequired: selectedReqClass.trim() || undefined,
        minHolders: Number(selectedReqMinHolders) || 1,
      },
    ]);
    setSelectedReqClass("");
    setSelectedReqMinHolders(1);
  };

  const removeRequiredLicence = (idx: number) => {
    setRequiredLicences(requiredLicences.filter((_, i) => i !== idx));
  };

  const toggleAssignee = (userId: string) => {
    const exists = assignees.find((a) => a.userId === userId);
    if (exists) {
      const remaining = assignees.filter((a) => a.userId !== userId);
      if (exists.isLead && remaining.length > 0 && remaining[0]) {
        remaining[0].isLead = true;
      }
      setAssignees(remaining);
    } else {
      setAssignees([...assignees, { userId, isLead: assignees.length === 0 }]);
    }
  };

  const toggleLead = (userId: string) => {
    setAssignees(
      assignees.map((a) => ({
        ...a,
        isLead: a.userId === userId ? !a.isLead : false,
      }))
    );
  };

  const executeSave = async (payload: any) => {
    try {
      const url = isEditing ? `/api/v1/seva/${initialData.id}` : "/api/v1/seva";
      const method = isEditing ? "PATCH" : "POST";

      if (isEditing) {
        payload.expectedVersion = initialData.version;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to save Seva");
        setIsLoading(false);
        return;
      }

      const savedId = isEditing ? initialData.id : json.data.id;
      if (licencesEnabled && savedId) {
        await fetch(`/api/v1/seva/${savedId}/required-licences`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requirements: requiredLicences }),
        }).catch(() => {});
      }

      onSuccess();
      onClose();
    } catch {
      setError("An unexpected error occurred while saving");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const payload: any = {
      title,
      description,
      kind,
      subKind: kind === "ONE_TIME" ? subKind : null,
      categoryId,
      areaId,
      priority,
      parentId: parentId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      scheduleMode,
      requiresVerification,
      estimatedBudget: estimatedBudget ? parseFloat(estimatedBudget) : null,
      assignees,
      checklist,
    };

    if (kind === "RECURRING") {
      payload.recurrence = {
        frequency,
        interval: Number(interval),
        byWeekday,
        byMonthDay,
        startDate: startDate ? new Date(startDate) : new Date(),
      };
    }

    // Licence compliance check
    if (licencesEnabled && requiredLicences.length > 0) {
      const missing: string[] = [];
      for (const req of requiredLicences) {
        const typeObj = licenceTypes.find((t) => t.id === req.licenceTypeId);
        const qualifyingCount = assignees.filter((a) => {
          const uRec = licenceDirectoryUsers.find((u) => u.id === a.userId);
          if (!uRec?.licences) return false;
          return uRec.licences.some((l: any) => {
            if (l.licenceTypeId !== req.licenceTypeId) return false;
            if (req.classRequired && l.class !== req.classRequired) return false;
            return l.status === "VALID" || l.status === "EXPIRING_SOON";
          });
        }).length;

        if (qualifyingCount < req.minHolders) {
          const typeName = typeObj?.name || "Licence";
          const classStr = req.classRequired ? ` (${req.classRequired})` : "";
          missing.push(`${typeName}${classStr} (requires ${req.minHolders}, but only ${qualifyingCount} assigned)`);
        }
      }

      if (missing.length > 0) {
        if (enforcementMode === "BLOCK") {
          setError(`Assignment BLOCKED: assignees do not hold required licences: ${missing.join("; ")}. An Administrator override is required.`);
          setIsLoading(false);
          return;
        }

        // WARN mode
        setPendingWarningPrompt({
          message: `Warning: The assigned volunteers do not satisfy the required tickets: ${missing.join(", ")}. Proceed anyway? (This confirmation will be logged).`,
          onProceed: () => executeSave(payload),
        });
        setIsLoading(false);
        return;
      }
    }

    await executeSave(payload);
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={isEditing ? `Edit Seva: ${initialData?.code}` : "Create New Seva"}
        description="Define task details, assignments, scheduling and checklist"
        maxWidth="2xl"
      >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-xl text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <FormField label="Seva Title" required>
              <input
                type="text"
                required
                placeholder="e.g. Roof Structural Repairs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
            </FormField>
          </div>

          <FormField label="Task Kind" required>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className={selectClass}
              disabled={isEditing}
            >
              <option value="ONE_TIME">One-Time Job</option>
              <option value="RECURRING">Recurring Job</option>
            </select>
          </FormField>

          {kind === "ONE_TIME" ? (
            <FormField label="Sub-Kind">
              <select
                value={subKind}
                onChange={(e) => setSubKind(e.target.value as any)}
                className={selectClass}
              >
                <option value="REPAIR">Repair / Maintenance</option>
                <option value="NEW">New Installation</option>
              </select>
            </FormField>
          ) : (
            <FormField label="Schedule Mode">
              <select
                value={scheduleMode}
                onChange={(e) => setScheduleMode(e.target.value as any)}
                className={selectClass}
              >
                <option value="FIXED">Fixed (Follows calendar schedule)</option>
                <option value="FLOATING">Floating (Interval after completion)</option>
              </select>
            </FormField>
          )}

          <FormField label="Category" required>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={selectClass}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Area / Location <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsQuickAddAreaOpen(true)}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                Add New Area
              </button>
            </div>
            <select
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
              className={selectClass}
              required
            >
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {buildAreaPath(a.id, areasMap)}
                </option>
              ))}
            </select>
          </div>

          <FormField label="Priority" required>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
              className={selectClass}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </FormField>

          <FormField label="Parent Project / Group (Optional)">
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={selectClass}
            >
              <option value="">None (Top-Level Node)</option>
              {treeNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code}: {n.title}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Start Date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Due Date">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Estimated Budget ($ AUD)">
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 5000"
              value={estimatedBudget}
              onChange={(e) => setEstimatedBudget(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="verificationCheck"
              checked={requiresVerification}
              onChange={(e) => setRequiresVerification(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="verificationCheck" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Requires Coordinator Verification before Done
            </label>
          </div>
        </div>

        {/* Recurrence Builder */}
        {kind === "RECURRING" && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Recurrence Schedule
            </span>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Frequency">
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className={selectClass}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="YEARLY">Yearly</option>
                  <option value="EVERY_N_DAYS">Every N Days</option>
                </select>
              </FormField>

              <FormField label="Interval">
                <input
                  type="number"
                  min="1"
                  value={interval}
                  onChange={(e) => setInterval(parseInt(e.target.value || "1", 10))}
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg text-xs border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                Preview: {recurrencePreview}
              </div>
              {nextThree.length > 0 && (
                <div className="text-[11px] text-slate-500 mt-1">
                  Next 3 dates: {nextThree.map((d: Date) => format(d, "dd MMM yyyy")).join(" • ")}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="sm:col-span-2">
          <FormField label="Description & Scope" required>
            <textarea
              rows={3}
              required
              placeholder="Describe the maintenance requirements in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={textareaClass}
            />
          </FormField>
        </div>

        {/* Required Licences & Tickets */}
        {licencesEnabled && (
          <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Required Licences & Tickets ({requiredLicences.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Mode: {enforcementMode === "BLOCK" ? "Strict (Block on deficit)" : "Advisory (Warn on deficit)"}
              </span>
            </div>

            {/* Existing requirements pills */}
            {requiredLicences.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {requiredLicences.map((req, idx) => {
                  const typeObj = licenceTypes.find((t) => t.id === req.licenceTypeId);
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200"
                    >
                      <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>
                        {typeObj?.name || "Licence"}
                        {req.classRequired ? ` (${req.classRequired})` : ""}
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold ml-1">×{req.minHolders}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRequiredLicence(idx)}
                        className="text-slate-400 hover:text-red-500 ml-1 p-0.5 rounded"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Add requirement inline form */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs">
              <div className="flex-1 min-w-[140px]">
                <select
                  value={selectedReqTypeId}
                  onChange={(e) => setSelectedReqTypeId(e.target.value)}
                  className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  {licenceTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="w-28">
                <input
                  type="text"
                  placeholder="Class (opt)"
                  value={selectedReqClass}
                  onChange={(e) => setSelectedReqClass(e.target.value)}
                  className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <div className="w-20">
                <input
                  type="number"
                  min={1}
                  placeholder="Min"
                  value={selectedReqMinHolders}
                  onChange={(e) => setSelectedReqMinHolders(Number(e.target.value))}
                  className="w-full py-1 px-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRequiredLicence}
                icon={<Plus className="w-3.5 h-3.5" />}
              >
                Require Ticket
              </Button>
            </div>
          </div>
        )}

        {/* Assignees Selector */}
        <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Assignees ({assignees.length} selected)
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Click a member to add or remove. Click ★ on an assigned member to set as Team Lead.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {licencesEnabled && requiredLicences.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyShowEligible}
                    onChange={(e) => setOnlyShowEligible(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Only show eligible people</span>
                </label>
              )}
              {users.length > 3 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 w-40 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 min-h-[90px] max-h-44 overflow-y-auto">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center py-6 text-xs text-slate-500 dark:text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span>Loading community members...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                {users.length === 0
                  ? "No active community members found."
                  : `No members match the current filter.`}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredUsers.map((u) => {
                  const isAssigned = assignees.some((a) => a.userId === u.id);
                  const isLead = assignees.find((a) => a.userId === u.id)?.isLead;
                  const roleName = u.role?.name || "Member";

                  const uRec = licenceDirectoryUsers.find((ld: any) => ld.id === u.id);
                  const matchedLic = requiredLicences.length > 0 && uRec?.licences?.find((l: any) =>
                    requiredLicences.some((req) => req.licenceTypeId === l.licenceTypeId && (!req.classRequired || req.classRequired === l.class) && (l.status === "VALID" || l.status === "EXPIRING_SOON"))
                  );

                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleAssignee(u.id)}
                      className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border transition-all select-none ${
                        isAssigned
                          ? "bg-indigo-50 dark:bg-indigo-950/80 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-400/30"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100/60"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          isAssigned
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {isAssigned ? <Check className="w-3 h-3 stroke-[3]" /> : (u.name?.charAt(0) || "U")}
                      </div>

                      <div className="flex flex-col">
                        <span className="font-medium leading-tight">{u.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-slate-400 leading-tight">
                            {roleName.replace(/_/g, " ")}
                          </span>
                          {licencesEnabled && requiredLicences.length > 0 && (
                            matchedLic ? (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <Award className="w-2.5 h-2.5 text-emerald-500" /> Qualified
                              </span>
                            ) : (
                              <span className="text-[9px] text-amber-500 dark:text-amber-400 font-medium flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5 text-amber-500" /> Uncertified
                              </span>
                            )
                          )}
                        </div>
                      </div>

                      {isAssigned && (
                        <button
                          type="button"
                          title={isLead ? "Team Lead (click to toggle off)" : "Make Team Lead"}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLead(u.id);
                          }}
                          className={`ml-1 p-1 rounded-md transition-colors ${
                            isLead
                              ? "text-amber-500 bg-amber-100 dark:bg-amber-950/60"
                              : "text-slate-300 dark:text-slate-600 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isLead ? "fill-current" : ""}`} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Checklist Builder */}
        <div className="sm:col-span-2 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Checklist Items ({checklist.length})
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Inspect safety valves"
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
              className={`${inputClass} text-xs`}
            />
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem} icon={<Plus className="w-3.5 h-3.5" />}>
              Add
            </Button>
          </div>

          {checklist.length > 0 && (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs border border-slate-200 dark:border-slate-700"
                >
                  <span>{idx + 1}. {item.text}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    className="text-slate-400 hover:text-red-500 p-1 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            {isEditing ? "Save Changes" : "Create Seva"}
          </Button>
        </div>
      </form>
    </Modal>
    {pendingWarningPrompt && (
      <ConfirmDialog
        isOpen={!!pendingWarningPrompt}
        onClose={() => setPendingWarningPrompt(null)}
        onConfirm={() => {
          const fn = pendingWarningPrompt.onProceed;
          setPendingWarningPrompt(null);
          fn();
        }}
        title="Licence Compliance Warning"
        message={pendingWarningPrompt.message}
        confirmLabel="Confirm & Proceed"
        variant="primary"
      />
    )}

    <QuickAddAreaModal
      isOpen={isQuickAddAreaOpen}
      onClose={() => setIsQuickAddAreaOpen(false)}
      existingAreas={areas}
      onAreaCreated={(newArea) => {
        setAreas((prev) => [...prev, newArea]);
        setAreaId(newArea.id);
      }}
    />
  </>
  );
}
