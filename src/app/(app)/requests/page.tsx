"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileQuestion, Plus, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField, inputClass, selectClass, textareaClass } from "@/core/ui-kit/FormField";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { format } from "date-fns";
import { buildAreaPath, AreaItem } from "@/modules/masters/utils";

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<AreaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const areasMap = React.useMemo(() => {
    const map = new Map<string, AreaItem>();
    areas.forEach((a) => map.set(a.id, a));
    return map;
  }, [areas]);

  // Submit Modal
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [areaId, setAreaId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Convert Modal
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [convertPriority, setConvertPriority] = useState("MEDIUM");
  const [convertDueDate, setConvertDueDate] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/requests");
      if (res.ok) {
        const json = await res.json();
        setRequests(json.data || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => {
        setCategories(j.data || []);
        if (j.data?.[0]) setCategoryId(j.data[0].id);
      })
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => {
        setAreas(j.data || []);
        if (j.data?.[0]) setAreaId(j.data[0].id);
      })
      .catch(() => {});
  }, []);

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId,
          areaId,
        }),
      });
      if (res.ok) {
        setIsSubmitOpen(false);
        setTitle("");
        setDescription("");
        loadRequests();
      }
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    setIsConverting(true);
    try {
      const res = await fetch(`/api/v1/requests/${selectedRequest.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: convertPriority,
          dueDate: convertDueDate || undefined,
        }),
      });
      if (res.ok) {
        setSelectedRequest(null);
        loadRequests();
      }
    } catch {
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileQuestion className="w-6 h-6 text-indigo-600" /> Maintenance Requests
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Submit issues observed in the community; coordinators convert them into active tasks
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setIsSubmitOpen(true)} icon={<Plus className="w-4 h-4" />}>
          Submit Request
        </Button>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          title="No requests submitted"
          description="Members can submit maintenance observations and repairs here."
          actionLabel="Submit Request"
          onAction={() => setIsSubmitOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge size="sm" variant={req.status === "OPEN" ? "warning" : req.status === "CONVERTED" ? "success" : "danger"}>
                    {req.status}
                  </Badge>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(req.createdAt), "dd MMM yyyy")}
                  </span>
                </div>

                <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{req.title}</div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{req.description}</p>

                <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                  <span>{req.category?.name}</span>
                  <span>•</span>
                  <span>{req.area?.name}</span>
                  <span>•</span>
                  <span>By {req.requestedBy?.name}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                {req.status === "CONVERTED" && req.convertedSeva ? (
                  <Link
                    href={`/seva/${req.convertedSeva.id}`}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View Task {req.convertedSeva.code} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : req.status === "OPEN" ? (
                  <Button size="sm" variant="primary" onClick={() => setSelectedRequest(req)}>
                    Convert to Seva
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400">Archived</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit Request Modal */}
      <Modal isOpen={isSubmitOpen} onClose={() => setIsSubmitOpen(false)} title="Submit Maintenance Request">
        <form onSubmit={handleSubmitRequest} className="space-y-3">
          <FormField label="Issue Summary / Title" required>
            <input
              type="text"
              required
              placeholder="e.g. Broken garden sprinkler head near eastern flowerbed"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <FormField label="Category" required>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Area / Location" required>
            <select value={areaId} onChange={(e) => setAreaId(e.target.value)} className={selectClass}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{buildAreaPath(a.id, areasMap)}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Description" required>
            <textarea
              rows={3}
              required
              placeholder="Provide exact details of the observed maintenance issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={textareaClass}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsSubmitOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Convert to Seva Modal */}
      <Modal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        title={`Convert: ${selectedRequest?.title}`}
      >
        <form onSubmit={handleConvert} className="space-y-3">
          <p className="text-xs text-slate-500 mb-2">
            This will create an active Seva task with initial work occurrence and notify the submitter.
          </p>

          <FormField label="Priority">
            <select value={convertPriority} onChange={(e) => setConvertPriority(e.target.value)} className={selectClass}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </FormField>

          <FormField label="Target Due Date">
            <input
              type="date"
              value={convertDueDate}
              onChange={(e) => setConvertDueDate(e.target.value)}
              className={inputClass}
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isConverting}>
              Create Seva
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
