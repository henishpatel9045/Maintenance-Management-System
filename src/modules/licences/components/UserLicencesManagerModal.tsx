"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/core/ui-kit/Modal";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { FormField, inputClass, selectClass, textareaClass } from "@/core/ui-kit/FormField";
import {
  Award,
  Plus,
  RefreshCw,
  Archive,
  Ban,
  FileText,
  Eye,
  History,
  Trash2,
  Calendar,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { format } from "date-fns";

export interface UserLicencesManagerModalProps {
  userId: string;
  userName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UserLicencesManagerModal({
  userId,
  userName,
  isOpen,
  onClose,
}: UserLicencesManagerModalProps) {
  const [licences, setLicences] = useState<any[]>([]);
  const [licenceTypes, setLicenceTypes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revealedNumbers, setRevealedNumbers] = useState<Record<string, string>>({});

  // Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [licenceClass, setLicenceClass] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [conditions, setConditions] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit modal state
  const [editingLicence, setEditingLicence] = useState<any | null>(null);

  // Renew modal state
  const [renewingLicence, setRenewingLicence] = useState<any | null>(null);
  const [renewExpiresAt, setRenewExpiresAt] = useState("");
  const [renewNumber, setRenewNumber] = useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [lRes, tRes] = await Promise.all([
        fetch(`/api/v1/users/${userId}/licences`),
        fetch("/api/v1/licence-types"),
      ]);
      if (lRes.ok) {
        const lj = await lRes.json();
        setLicences(lj.data || []);
      }
      if (tRes.ok) {
        const tj = await tRes.json();
        setLicenceTypes(tj.data || []);
        if (tj.data?.[0]) setSelectedTypeId(tj.data[0].id);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      loadData();
    }
  }, [isOpen, userId]);

  const handleReveal = async (licenceId: string) => {
    try {
      const res = await fetch(`/api/v1/licences/${licenceId}/reveal-number`, { method: "POST" });
      if (res.ok) {
        const j = await res.json();
        setRevealedNumbers((prev) => ({ ...prev, [licenceId]: j.data?.licenceNumber || "None" }));
      }
    } catch {}
  };

  const handleCreateLicence = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/${userId}/licences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenceTypeId: selectedTypeId,
          class: licenceClass.trim() || undefined,
          licenceNumber: licenceNumber.trim() || undefined,
          issuer: issuer.trim() || undefined,
          issuedAt: issuedAt || undefined,
          expiresAt: expiresAt || undefined,
          conditions: conditions.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error?.message || "Failed to create licence");
        setIsSubmitting(false);
        return;
      }
      setIsAddOpen(false);
      setLicenceNumber("");
      setLicenceClass("");
      setConditions("");
      setNotes("");
      loadData();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLicence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLicence) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/licences/${editingLicence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: editingLicence.version,
          class: editingLicence.class || undefined,
          licenceNumber: editingLicence.licenceNumber || undefined,
          issuer: editingLicence.issuer || undefined,
          issuedAt: editingLicence.issuedAt || undefined,
          expiresAt: editingLicence.expiresAt || undefined,
          conditions: editingLicence.conditions || undefined,
          notes: editingLicence.notes || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error?.message || "Failed to update licence");
        setIsSubmitting(false);
        return;
      }
      setEditingLicence(null);
      loadData();
    } catch {
      setError("An error occurred while updating");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenewLicence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingLicence) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/v1/licences/${renewingLicence.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expiresAt: renewExpiresAt,
          licenceNumber: renewNumber.trim() || undefined,
        }),
      });
      if (res.ok) {
        setRenewingLicence(null);
        setRenewExpiresAt("");
        setRenewNumber("");
        loadData();
      }
    } catch {} finally {
      setIsSubmitting(false);
    }
  };

  const handleSuspend = async (licenceId: string) => {
    try {
      await fetch(`/api/v1/licences/${licenceId}/suspend`, { method: "POST" });
      loadData();
    } catch {}
  };

  const handleRevoke = async (licenceId: string) => {
    const reason = prompt("Enter reason for revoking this licence:");
    if (!reason) return;
    try {
      await fetch(`/api/v1/licences/${licenceId}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      loadData();
    } catch {}
  };

  const handleArchive = async (licenceId: string) => {
    if (!confirm("Are you sure you want to archive this licence record?")) return;
    try {
      await fetch(`/api/v1/licences/${licenceId}/archive`, { method: "POST" });
      loadData();
    } catch {}
  };

  const activeLicences = licences.filter((l) => !l.archivedAt && !l.supersededById);
  const supersededLicences = licences.filter((l) => Boolean(l.supersededById));

  const selectedType = licenceTypes.find((t) => t.id === selectedTypeId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Licences & Tickets: ${userName}`}
      description="Manage qualifications, renewals, scans and superseded historical records"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Header action */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Active Licences ({activeLicences.length})
          </span>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Licence
          </Button>
        </div>

        {/* Active Licences List */}
        {isLoading ? (
          <p className="text-xs text-slate-400 py-6 text-center">Loading qualifications...</p>
        ) : activeLicences.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
            No active licences or tickets currently recorded for this user.
          </div>
        ) : (
          <div className="space-y-2">
            {activeLicences.map((l) => {
              const isRevealed = Boolean(revealedNumbers[l.id]);
              const displayNum = isRevealed ? revealedNumbers[l.id] : (l.licenceNumberMasked || l.licenceNumber || "•••••");

              return (
                <div
                  key={l.id}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold">
                        <Award className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          {l.licenceType?.name || "Licence"}
                          {l.class && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 font-mono">
                              {l.class}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Issuer: {l.issuer || "Not specified"} • Source: {l.source}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        size="sm"
                        variant={
                          l.status === "VALID"
                            ? "success"
                            : l.status === "EXPIRING_SOON"
                            ? "warning"
                            : l.status === "EXPIRED"
                            ? "danger"
                            : "neutral"
                        }
                      >
                        {l.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Details row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                    <div>
                      <span className="text-slate-400">Number: </span>
                      <span className="font-mono font-medium">{displayNum}</span>
                      {!isRevealed && l.licenceNumberMasked && (
                        <button
                          type="button"
                          onClick={() => handleReveal(l.id)}
                          className="ml-1.5 text-indigo-600 hover:underline"
                        >
                          Reveal
                        </button>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400">Expires: </span>
                      <span className="font-medium">
                        {l.expiresAt ? format(new Date(l.expiresAt), "dd MMM yyyy") : "No Expiry"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Verified: </span>
                      <span className="font-medium">
                        {l.verifiedAt ? `Yes (${format(new Date(l.verifiedAt), "dd MMM yyyy")})` : "Pending"}
                      </span>
                    </div>
                  </div>

                  {l.conditions && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded">
                      <span className="font-semibold">Conditions:</span> {l.conditions}
                    </div>
                  )}

                  {/* Document Scans */}
                  {l.files && l.files.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {l.files.map((fl: any) => (
                        <a
                          key={fl.id}
                          href={`/api/v1/licences/${l.id}/files/${fl.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] text-indigo-600 hover:underline"
                        >
                          <FileText className="w-3 h-3 text-slate-400" />
                          <span>{fl.kind || "SCAN"}: {fl.fileObject?.originalName || "Document"}</span>
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingLicence(l)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRenewingLicence(l);
                        setRenewExpiresAt(
                          l.expiresAt ? format(new Date(l.expiresAt), "yyyy-MM-dd") : ""
                        );
                        setRenewNumber(l.licenceNumber || "");
                      }}
                      icon={<RefreshCw className="w-3 h-3" />}
                    >
                      Renew
                    </Button>
                    {l.status !== "SUSPENDED" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSuspend(l.id)}
                      >
                        Suspend
                      </Button>
                    )}
                    {l.status !== "REVOKED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRevoke(l.id)}
                      >
                        Revoke
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchive(l.id)}
                      icon={<Archive className="w-3 h-3 text-slate-400" />}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Superseded Records History */}
        {supersededLicences.length > 0 && (
          <div className="pt-2">
            <details className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <summary className="font-bold text-slate-600 dark:text-slate-400 cursor-pointer flex items-center gap-1.5">
                <History className="w-4 h-4 text-indigo-600" />
                History of Superseded Records ({supersededLicences.length})
              </summary>
              <div className="space-y-2 mt-3">
                {supersededLicences.map((sl) => (
                  <div
                    key={sl.id}
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-500"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {sl.licenceType?.name} {sl.class ? `(${sl.class})` : ""}
                      </span>
                      <Badge size="sm" variant="neutral">SUPERSEDED</Badge>
                    </div>
                    <div className="text-[10px] mt-1 text-slate-400">
                      Expired: {sl.expiresAt ? format(new Date(sl.expiresAt), "dd MMM yyyy") : "N/A"} •
                      Version {sl.version} • Replaced by newer renewed record
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      {/* Add Licence Modal */}
      {isAddOpen && (
        <Modal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          title={`Add Licence: ${userName}`}
          description="Register a new qualification or ticket for this volunteer"
          maxWidth="md"
        >
          <form onSubmit={handleCreateLicence} className="space-y-3">
            {error && (
              <div className="p-2.5 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs">
                {error}
              </div>
            )}
            <FormField label="Licence Type" required>
              <select
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
                className={selectClass}
              >
                {licenceTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.kind})
                  </option>
                ))}
              </select>
            </FormField>

            {selectedType?.classes && selectedType.classes.length > 0 ? (
              <FormField label="Class / Grade">
                <select
                  value={licenceClass}
                  onChange={(e) => setLicenceClass(e.target.value)}
                  className={selectClass}
                >
                  <option value="">Select allowed class...</option>
                  {selectedType.classes.map((cls: string) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <FormField label="Class / Endorsement">
                <input
                  type="text"
                  placeholder="e.g. LF, Open"
                  value={licenceClass}
                  onChange={(e) => setLicenceClass(e.target.value)}
                  className={inputClass}
                />
              </FormField>
            )}

            <FormField label="Licence Number">
              <input
                type="text"
                placeholder="Unique certificate or licence number"
                value={licenceNumber}
                onChange={(e) => setLicenceNumber(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <FormField label="Issuing Body">
              <input
                type="text"
                placeholder="e.g. SafeWork NSW, St John Ambulance"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-2">
              <FormField label="Issued Date">
                <input
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Expiry Date">
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={inputClass}
                />
              </FormField>
            </div>

            <FormField label="Conditions or Restrictions">
              <input
                type="text"
                placeholder="e.g. Daylight hours only"
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className={inputClass}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" isLoading={isSubmitting}>
                Save Licence
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Licence Modal */}
      {editingLicence && (
        <Modal
          isOpen={!!editingLicence}
          onClose={() => setEditingLicence(null)}
          title={`Edit Licence: ${editingLicence.licenceType?.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleEditLicence} className="space-y-3">
            <FormField label="Class / Grade">
              <input
                type="text"
                value={editingLicence.class || ""}
                onChange={(e) => setEditingLicence({ ...editingLicence, class: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Licence Number">
              <input
                type="text"
                value={editingLicence.licenceNumber || ""}
                onChange={(e) => setEditingLicence({ ...editingLicence, licenceNumber: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <FormField label="Issuing Body">
              <input
                type="text"
                value={editingLicence.issuer || ""}
                onChange={(e) => setEditingLicence({ ...editingLicence, issuer: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Issued Date">
                <input
                  type="date"
                  value={editingLicence.issuedAt ? format(new Date(editingLicence.issuedAt), "yyyy-MM-dd") : ""}
                  onChange={(e) => setEditingLicence({ ...editingLicence, issuedAt: e.target.value })}
                  className={inputClass}
                />
              </FormField>
              <FormField label="Expiry Date">
                <input
                  type="date"
                  value={editingLicence.expiresAt ? format(new Date(editingLicence.expiresAt), "yyyy-MM-dd") : ""}
                  onChange={(e) => setEditingLicence({ ...editingLicence, expiresAt: e.target.value })}
                  className={inputClass}
                />
              </FormField>
            </div>
            <FormField label="Conditions">
              <input
                type="text"
                value={editingLicence.conditions || ""}
                onChange={(e) => setEditingLicence({ ...editingLicence, conditions: e.target.value })}
                className={inputClass}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setEditingLicence(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" isLoading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Renew Licence Modal */}
      {renewingLicence && (
        <Modal
          isOpen={!!renewingLicence}
          onClose={() => setRenewingLicence(null)}
          title={`Renew Licence: ${renewingLicence.licenceType?.name}`}
          description="Creates a renewed record and preserves the previous version as SUPERSEDED in history"
          maxWidth="sm"
        >
          <form onSubmit={handleRenewLicence} className="space-y-3">
            <FormField label="New Expiry Date" required>
              <input
                type="date"
                required
                value={renewExpiresAt}
                onChange={(e) => setRenewExpiresAt(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Licence Number (if updated)">
              <input
                type="text"
                placeholder={renewingLicence.licenceNumber || "Leave empty if unchanged"}
                value={renewNumber}
                onChange={(e) => setRenewNumber(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setRenewingLicence(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" isLoading={isSubmitting}>
                Renew Licence
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
