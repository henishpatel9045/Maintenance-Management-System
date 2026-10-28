"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  ChevronRight,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  FileText,
  Download,
  Building,
  User,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField } from "@/core/ui-kit/FormField";
import { format } from "date-fns";

export default function ContractorRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const requestId = resolvedParams.id;
  const router = useRouter();

  const [request, setRequest] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-field acceptance state for update requests
  const [acceptedFields, setAcceptedFields] = useState<Record<string, boolean>>({});

  // Editable form state for new contractor requests
  const [newContractorForm, setNewContractorForm] = useState<any>({});

  // Action Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [isMoreInfoModalOpen, setIsMoreInfoModalOpen] = useState(false);
  const [moreInfoMessage, setMoreInfoMessage] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatDateSafe = (dateVal: any, formatStr = "dd MMM yyyy, HH:mm") => {
    if (!dateVal) return "—";
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? "—" : format(d, formatStr);
  };

  const loadRequest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/contractor-requests/${requestId}`);
      if (!res.ok) {
        setError("Failed to load request or permission denied.");
        return;
      }
      const j = await res.json();
      const raw = j.data;
      const actualRequest = raw?.request || raw;
      const actualFiles = raw?.files || actualRequest?.files || [];
      const actualDiff = raw?.diff || null;
      const actualConflict = raw?.versionConflict || false;

      let comparisonObj: any = null;
      if (actualDiff) {
        const differences = Object.entries(actualDiff).map(([field, val]: [string, any]) => ({
          field,
          currentValue: val.current,
          proposedValue: val.proposed,
          changed: val.changed,
        }));
        comparisonObj = {
          differences,
          hasConflict: actualConflict,
        };
      } else if (j.comparison) {
        comparisonObj = j.comparison;
      }

      setRequest({
        ...actualRequest,
        files: actualFiles,
      });
      setComparison(comparisonObj);
      if (comparisonObj?.differences) {
        const initialAccept: Record<string, boolean> = {};
        comparisonObj.differences.forEach((d: any) => {
          initialAccept[d.field] = true;
        });
        setAcceptedFields(initialAccept);
      }
      if (actualRequest?.type === "NEW_CONTRACTOR") {
        setNewContractorForm(actualRequest.proposedData || {});
      }
    } catch {
      setError("Network error loading request.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequest();
  }, [requestId]);

  const handleToggleField = (field: string) => {
    setAcceptedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      let body: any = {};
      if (request.type === "UPDATE_CONTRACTOR") {
        const fieldsToAccept = Object.keys(acceptedFields).filter((k) => acceptedFields[k]);
        if (fieldsToAccept.length === 0) {
          alert("Please select at least one field to accept.");
          setIsSubmitting(false);
          return;
        }
        body = { acceptedFields: fieldsToAccept };
      } else {
        body = { editedData: newContractorForm };
      }

      const res = await fetch(`/api/v1/contractor-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errJson = await res.json();
        alert(errJson.error?.message || "Approval failed.");
        setIsSubmitting(false);
        return;
      }

      const j = await res.json();
      router.push(`/contractors/${j.data.resultingContractorId || request.contractorId}`);
    } catch {
      alert("Network error processing approval.");
      setIsSubmitting(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/contractor-requests/${requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      if (res.ok) {
        setIsRejectModalOpen(false);
        loadRequest();
      }
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  const handleMoreInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moreInfoMessage.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/contractor-requests/${requestId}/more-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: moreInfoMessage.trim() }),
      });
      if (res.ok) {
        setIsMoreInfoModalOpen(false);
        loadRequest();
      }
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading proposal details...</div>;
  }

  if (error || !request) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold">Request Not Found</h2>
        <p className="text-xs text-slate-500">{error}</p>
        <Link href="/contractors/requests">
          <Button variant="secondary">Back to Queue</Button>
        </Link>
      </div>
    );
  }

  const isPending = request.status === "OPEN";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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
        <Link href="/contractors/requests" className="hover:underline">
          Review Queue
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">{request.code}</span>
      </div>

      {/* Header Info */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/40">
                {request.code}
              </span>
              <Badge
                size="sm"
                variant={
                  request.status === "OPEN"
                    ? "warning"
                    : request.status === "APPROVED"
                    ? "success"
                    : request.status === "PARTIALLY_APPROVED"
                    ? "info"
                    : "danger"
                }
              >
                {request.status}
              </Badge>
              <Badge size="sm" variant="neutral">
                {request.type === "NEW_CONTRACTOR" ? "New Contractor Proposal" : "Update Suggestion"}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {request.proposedData?.companyName || request.contractor?.companyName}
            </h1>
          </div>

          {/* Action Buttons if OPEN */}
          {isPending && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                className="text-xs"
                onClick={() => setIsMoreInfoModalOpen(true)}
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1" /> Request Info
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-rose-600 hover:text-rose-700"
                onClick={() => setIsRejectModalOpen(true)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                className="text-xs gap-1"
                disabled={isSubmitting}
                onClick={handleApprove}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Apply
              </Button>
            </div>
          )}
        </div>

        {/* Requester Metadata */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs flex flex-wrap items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-indigo-500" />
            <span>
              Submitted by <strong>{request.requestedBy?.name || "Member"}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4" />
            <span>{formatDateSafe(request.createdAt)}</span>
          </div>
        </div>

        {/* Requester Note */}
        <div className="text-xs space-y-1">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Requester Reason / Context:</span>
          <p className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
            {request.note}
          </p>
        </div>

        {/* Supporting Files */}
        {request.files?.length > 0 && (
          <div className="text-xs space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Attached Supporting Files ({request.files.length})
            </span>
            <div className="flex flex-wrap gap-2">
              {request.files.map((f: any) => (
                <a
                  key={f.id}
                  href={`/api/v1/contractor-files/${f.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 text-indigo-600 hover:underline"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{f.label || f.fileObject?.originalName || "Document"}</span>
                  <Download className="w-3 h-3 text-slate-400" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review Section */}

      {/* CASE A: UPDATE_CONTRACTOR - SIDE-BY-SIDE DIFF */}
      {request.type === "UPDATE_CONTRACTOR" && comparison && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Side-by-Side Comparison
              </h2>
              <p className="text-xs text-slate-500">
                Select the checkbox next to each field you want to apply to the contractor record.
              </p>
            </div>
            {isPending && (
              <div className="flex items-center gap-2 text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allTrue: Record<string, boolean> = {};
                    comparison.differences?.forEach((d: any) => {
                      allTrue[d.field] = true;
                    });
                    setAcceptedFields(allTrue);
                  }}
                >
                  Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAcceptedFields({})}
                >
                  Deselect All
                </Button>
              </div>
            )}
          </div>

          {/* Version Conflict Warning if contractor changed */}
          {comparison.hasConflict && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                <strong>Notice:</strong> This contractor has been updated by another user since this request was submitted. Please verify current values carefully.
              </span>
            </div>
          )}

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {isPending && <th className="py-2.5 px-3 w-10">Accept</th>}
                  <th className="py-2.5 px-3">Field</th>
                  <th className="py-2.5 px-3">Current Value</th>
                  <th className="py-2.5 px-3">Proposed Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {comparison.differences?.map((diff: any) => (
                  <tr
                    key={diff.field}
                    className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/40 ${
                      acceptedFields[diff.field] ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                    }`}
                  >
                    {isPending && (
                      <td className="py-2.5 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!acceptedFields[diff.field]}
                          onChange={() => handleToggleField(diff.field)}
                        />
                      </td>
                    )}
                    <td className="py-2.5 px-3 font-semibold text-slate-700 dark:text-slate-300 capitalize">
                      {diff.field.replace(/([A-Z])/g, " $1")}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {String(diff.currentValue || "—")}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-mono font-medium">
                      {String(diff.proposedValue || "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CASE B: NEW_CONTRACTOR - PREFILLED EDITABLE FORM */}
      {request.type === "NEW_CONTRACTOR" && (
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Contractor Registration Review
            </h2>
            <p className="text-xs text-slate-500">
              Verify and edit the proposed details below before accepting and registering into the directory.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <FormField label="Company Name" required>
              <input
                type="text"
                disabled={!isPending}
                value={newContractorForm.companyName || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, companyName: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Trading Name">
              <input
                type="text"
                disabled={!isPending}
                value={newContractorForm.tradingName || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, tradingName: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Registration #">
              <input
                type="text"
                disabled={!isPending}
                value={newContractorForm.registrationNumber || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, registrationNumber: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl font-mono dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Main Phone">
              <input
                type="text"
                disabled={!isPending}
                value={newContractorForm.mainPhone || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, mainPhone: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Main Email">
              <input
                type="email"
                disabled={!isPending}
                value={newContractorForm.mainEmail || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, mainEmail: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Suburb">
              <input
                type="text"
                disabled={!isPending}
                value={newContractorForm.suburb || ""}
                onChange={(e) =>
                  setNewContractorForm({ ...newContractorForm, suburb: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {isRejectModalOpen && (
        <Modal
          isOpen={isRejectModalOpen}
          onClose={() => setIsRejectModalOpen(false)}
          title="Decline Contractor Proposal"
        >
          <form onSubmit={handleReject} className="space-y-4 text-xs">
            <p className="text-slate-500">
              Please provide a clear reason for declining this request. The requester will receive this feedback.
            </p>
            <FormField label="Reason for Declining" required>
              <textarea
                rows={3}
                required
                placeholder="e.g. Contractor is already registered, or does not service our region..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={isSubmitting}>
                Decline Proposal
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* More Info Modal */}
      {isMoreInfoModalOpen && (
        <Modal
          isOpen={isMoreInfoModalOpen}
          onClose={() => setIsMoreInfoModalOpen(false)}
          title="Request More Information"
        >
          <form onSubmit={handleMoreInfo} className="space-y-4 text-xs">
            <p className="text-slate-500">
              Send a note to the requester asking for clarifying details or supporting documents.
            </p>
            <FormField label="Questions / Clarification Needed" required>
              <textarea
                rows={3}
                required
                placeholder="e.g. Could you please provide their ABN or contact phone number?"
                value={moreInfoMessage}
                onChange={(e) => setMoreInfoMessage(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsMoreInfoModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Send Request to Member
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
