"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Award,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Copy,
  Plus,
  RefreshCw,
  FileText,
  Upload,
  Download,
  Check,
  ChevronRight,
  TrendingUp,
  Users,
  ShieldAlert,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { EmptyState } from "@/core/ui-kit/EmptyState";

export default function LicencesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active Tab
  const initialTab = searchParams.get("tab") || "my";
  const [activeTab, setActiveTab] = useState(initialTab);

  // User context
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Fetch current user & permissions
  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch("/api/v1/auth/me");
        if (res.ok) {
          const json = await res.json();
          setCurrentUser(json.data);
        }
      } catch (e) {
        console.error("Failed to load user:", e);
      } finally {
        setLoadingUser(false);
      }
    }
    loadUser();
  }, []);

  const perms = useMemo(() => {
    return new Set<string>(currentUser?.permissions || []);
  }, [currentUser]);

  const canDirectoryView = perms.has("licences.directory.view") || perms.has("licences.manage");
  const canVerify = perms.has("licences.verify");
  const canTypesManage = perms.has("licences.types.manage");
  const canImport = perms.has("licences.import");
  const canDirectoryContact = perms.has("licences.directory.contact") || perms.has("licences.manage");
  const canSensitiveView = perms.has("licences.sensitive.view");
  const canReportsView = perms.has("licences.reports.view");

  // Sync tab with URL
  const switchTab = (tab: string) => {
    setActiveTab(tab);
    router.replace(`/licences?tab=${tab}`);
  };

  if (loadingUser) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500">Loading Licences & Competencies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Licences & Competencies Register
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                Central register of licences, tickets, certifications, and volunteer availability.
              </p>
            </div>
          </div>
        </div>

        {/* Global Export Button */}
        {canReportsView && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                window.open("/api/v1/licence-reports/export?reportType=HOLDERS_BY_TYPE&format=csv", "_blank");
              }}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={() => {
                window.open("/api/v1/licence-reports/export?reportType=HOLDERS_BY_TYPE&format=pdf", "_blank");
              }}
            >
              Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        <TabButton
          label="My Licences"
          active={activeTab === "my"}
          onClick={() => switchTab("my")}
          icon={<Award className="w-4 h-4" />}
        />

        {canDirectoryView && (
          <>
            <TabButton
              label="Directory"
              active={activeTab === "directory"}
              onClick={() => switchTab("directory")}
              icon={<Search className="w-4 h-4" />}
            />
            <TabButton
              label="Summary Dashboard"
              active={activeTab === "summary"}
              onClick={() => switchTab("summary")}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <TabButton
              label="Find Volunteers"
              active={activeTab === "find"}
              onClick={() => switchTab("find")}
              icon={<Users className="w-4 h-4" />}
            />
            <TabButton
              label="Matrix"
              active={activeTab === "matrix"}
              onClick={() => switchTab("matrix")}
              icon={<SlidersHorizontal className="w-4 h-4" />}
            />
          </>
        )}

        {canVerify && (
          <TabButton
            label="Verification Queue"
            active={activeTab === "verify"}
            onClick={() => switchTab("verify")}
            icon={<Clock className="w-4 h-4" />}
          />
        )}

        {canTypesManage && (
          <TabButton
            label="Licence Types"
            active={activeTab === "types"}
            onClick={() => switchTab("types")}
            icon={<FileText className="w-4 h-4" />}
          />
        )}

        {canImport && (
          <TabButton
            label="CSV Import"
            active={activeTab === "import"}
            onClick={() => switchTab("import")}
            icon={<Upload className="w-4 h-4" />}
          />
        )}
      </div>

      {/* Tab Contents */}
      {activeTab === "my" && <MyLicencesTab currentUser={currentUser} />}
      {activeTab === "directory" && canDirectoryView && (
        <DirectoryTab
          canContact={canDirectoryContact}
          canSensitiveView={canSensitiveView}
        />
      )}
      {activeTab === "summary" && canDirectoryView && <SummaryTab />}
      {activeTab === "find" && canDirectoryView && (
        <FindVolunteersTab canContact={canDirectoryContact} />
      )}
      {activeTab === "matrix" && canDirectoryView && <MatrixTab />}
      {activeTab === "verify" && canVerify && <VerificationQueueTab />}
      {activeTab === "types" && canTypesManage && <LicenceTypesTab />}
      {activeTab === "import" && canImport && <ImportTab />}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ==========================================
// 1. MY LICENCES TAB
// ==========================================
function MyLicencesTab({ currentUser }: { currentUser: any }) {
  const [licences, setLicences] = useState<any[]>([]);
  const [availability, setAvailability] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [renewingLicence, setRenewingLicence] = useState<any>(null);
  const [types, setTypes] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [licRes, availRes, typesRes] = await Promise.all([
        fetch("/api/v1/me/licences"),
        fetch("/api/v1/me/availability"),
        fetch("/api/v1/licence-types?activeOnly=true"),
      ]);

      if (licRes.ok) {
        const json = await licRes.json();
        setLicences(json.data || []);
      }
      if (availRes.ok) {
        const json = await availRes.json();
        setAvailability(json.data);
      }
      if (typesRes.ok) {
        const json = await typesRes.json();
        setTypes(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAvailabilityChange = async (status: string, note?: string) => {
    try {
      const res = await fetch("/api/v1/me/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, note: note || availability?.note }),
      });
      if (res.ok) {
        const json = await res.json();
        setAvailability(json.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWithdraw = async (licenceId: string) => {
    if (!confirm("Are you sure you want to withdraw this pending submission?")) return;
    try {
      const res = await fetch(`/api/v1/me/licences/${licenceId}`, { method: "DELETE" });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Availability Bar Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              My Seva Availability Status
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Let coordinators know when you are available for assignments.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(["AVAILABLE", "LIMITED", "UNAVAILABLE"] as const).map((st) => (
              <button
                key={st}
                onClick={() => handleAvailabilityChange(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                  availability?.status === st
                    ? st === "AVAILABLE"
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : st === "LIMITED"
                      ? "bg-amber-600 border-amber-600 text-white"
                      : "bg-rose-600 border-rose-600 text-white"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {availability?.note && (
          <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Note: </span>
            {availability.note}
          </div>
        )}
      </div>

      {/* Licences List Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Registered Licences & Certifications ({licences.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Your verified tickets, forklift, first aid, working at heights, and other competencies.
          </p>
        </div>

        <Button
          onClick={() => setShowAddModal(true)}
          size="sm"
          icon={<Plus className="w-4 h-4" />}
        >
          Add Licence
        </Button>
      </div>

      {/* Licences Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : licences.length === 0 ? (
        <EmptyState
          title="No licences registered"
          description="You have not submitted or registered any tickets or licences yet. Click 'Add Licence' to submit your Forklift, White Card, First Aid or other tickets."
          actionLabel="Add Your First Licence"
          onAction={() => setShowAddModal(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {licences.map((lic) => {
            const isPending = lic.status === "PENDING_VERIFICATION";
            const isExpired = lic.status === "EXPIRED";
            const isExpiringSoon = lic.status === "EXPIRING_SOON";

            let expiryBadgeVariant: any = "success";
            let expiryText = "No Expiry";

            if (lic.expiresAt) {
              const expDate = new Date(lic.expiresAt);
              const now = new Date();
              const diffDays = Math.round((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

              if (diffDays < 0) {
                expiryBadgeVariant = "danger";
                expiryText = `Expired (${Math.abs(diffDays)}d ago)`;
              } else if (diffDays <= 30) {
                expiryBadgeVariant = "warning";
                expiryText = `Expires in ${diffDays} days`;
              } else {
                expiryBadgeVariant = "success";
                expiryText = `Expires ${expDate.toLocaleDateString("en-AU", { month: "short", year: "numeric" })}`;
              }
            }

            return (
              <div
                key={lic.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        {lic.licenceType?.category?.name || "Competency"}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {lic.licenceType?.name}
                      </h3>
                      {lic.class && (
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Class: {lic.class}
                        </span>
                      )}
                    </div>

                    <Badge
                      variant={
                        lic.status === "VALID"
                          ? "success"
                          : lic.status === "EXPIRING_SOON"
                          ? "warning"
                          : lic.status === "PENDING_VERIFICATION"
                          ? "info"
                          : "danger"
                      }
                    >
                      {lic.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {lic.licenceNumber && (
                    <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 font-mono">
                      <span className="text-slate-400 font-sans text-[11px]">No: </span>
                      {lic.licenceNumber}
                    </div>
                  )}

                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant={expiryBadgeVariant} size="sm">
                      <Clock className="w-3 h-3 mr-1" />
                      {expiryText}
                    </Badge>
                  </div>

                  {lic.notes && (
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {lic.notes}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  {isPending ? (
                    <button
                      onClick={() => handleWithdraw(lic.id)}
                      className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                    >
                      Withdraw submission
                    </button>
                  ) : (
                    <button
                      onClick={() => setRenewingLicence(lic)}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Renew
                    </button>
                  )}

                  <span className="text-[11px] text-slate-400">
                    Source: {lic.source === "SELF_SUBMITTED" ? "Self" : "Admin"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Licence Modal */}
      {showAddModal && (
        <SubmitLicenceModal
          types={types}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadData();
          }}
        />
      )}

      {/* Renew Licence Modal */}
      {renewingLicence && (
        <RenewLicenceModal
          licence={renewingLicence}
          onClose={() => setRenewingLicence(null)}
          onSuccess={() => {
            setRenewingLicence(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function SubmitLicenceModal({
  types,
  onClose,
  onSuccess,
}: {
  types: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [licenceTypeId, setLicenceTypeId] = useState(types[0]?.id || "");
  const [selectedClass, setSelectedClass] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [issuedAt, setIssuedAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = types.find((t) => t.id === licenceTypeId);

  useEffect(() => {
    if (selectedType?.classes && selectedType.classes.length > 0) {
      setSelectedClass(selectedType.classes[0]);
    } else {
      setSelectedClass("");
    }
    if (selectedType?.issuer) {
      setIssuer(selectedType.issuer);
    }
  }, [selectedType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Submit licence
      const res = await fetch("/api/v1/me/licences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenceTypeId,
          class: selectedClass || null,
          licenceNumber: licenceNumber || null,
          issuer: issuer || null,
          issuedAt: issuedAt || null,
          expiresAt: expiresAt || null,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to submit licence");
      }

      const json = await res.json();
      const newLicenceId = json.data.id;

      // 2. Upload file if provided
      if (file && newLicenceId) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("kind", "FRONT");
        await fetch(`/api/v1/me/licences/${newLicenceId}/files`, {
          method: "POST",
          body: formData,
        });
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add / Submit Licence" isOpen={true} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Licence or Ticket Type *
          </label>
          <select
            value={licenceTypeId}
            onChange={(e) => setLicenceTypeId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            required
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.category?.name})
              </option>
            ))}
          </select>
        </div>

        {selectedType?.classes && selectedType.classes.length > 0 && (
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Class / Level
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              {selectedType.classes.map((c: string) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Licence Number {selectedType?.requiresNumber && "*"}
            </label>
            <input
              type="text"
              value={licenceNumber}
              onChange={(e) => setLicenceNumber(e.target.value)}
              placeholder="e.g. LF-SA-12345"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              required={selectedType?.requiresNumber}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Issuing Body
            </label>
            <input
              type="text"
              value={issuer}
              onChange={(e) => setIssuer(e.target.value)}
              placeholder="e.g. SafeWork SA"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date Issued
            </label>
            <input
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Expiry Date {selectedType?.hasExpiry && "(leave blank if no expiry)"}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Photo / Scan of Document
          </label>
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Notes / Restrictions
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Any specific restrictions or additional details..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Submit for Verification
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenewLicenceModal({
  licence,
  onClose,
  onSuccess,
}: {
  licence: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [licenceNumber, setLicenceNumber] = useState(licence.licenceNumber || "");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState(licence.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/me/licences/${licence.id}/renew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          licenceNumber,
          expiresAt: expiresAt || null,
          notes,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Failed to renew licence");
      }

      onSuccess();
    } catch (e: any) {
      setError(e.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Renew ${licence.licenceType?.name}`} isOpen={true} onClose={onClose}>
      <form onSubmit={handleRenew} className="space-y-4 text-xs sm:text-sm">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-lg border border-rose-200">
            {error}
          </div>
        )}

        <p className="text-slate-500">
          Submitting a renewal creates a new pending record linked to your existing licence.
        </p>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Licence Number
          </label>
          <input
            type="text"
            value={licenceNumber}
            onChange={(e) => setLicenceNumber(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            New Expiry Date *
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            required
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Renewal Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Submit Renewal
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// 2. DIRECTORY TAB
// ==========================================
function DirectoryTab({
  canContact,
  canSensitiveView,
}: {
  canContact: boolean;
  canSensitiveView: boolean;
}) {
  const [people, setPeople] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedAvailability, setSelectedAvailability] = useState("");
  const [expiringWithinDays, setExpiringWithinDays] = useState("");
  const [validOnDate, setValidOnDate] = useState("");
  const [revealedNumbers, setRevealedNumbers] = useState<Record<string, string>>({});

  const fetchDirectory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (selectedType) params.set("licenceTypeId", selectedType);
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedStatus) params.set("status", selectedStatus);
      if (selectedAvailability) params.set("availability", selectedAvailability);
      if (expiringWithinDays) params.set("expiringWithinDays", expiringWithinDays);
      if (validOnDate) params.set("validOn", validOnDate);

      const res = await fetch(`/api/v1/licence-directory?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setPeople(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadMeta() {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/v1/licence-types?activeOnly=true"),
        fetch("/api/v1/licence-categories"),
      ]);
      if (tRes.ok) setTypes((await tRes.json()).data || []);
      if (cRes.ok) setCategories((await cRes.json()).data || []);
    }
    loadMeta();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDirectory();
    }, 250);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    selectedType,
    selectedCategory,
    selectedStatus,
    selectedAvailability,
    expiringWithinDays,
    validOnDate,
  ]);

  const handleReveal = async (licenceId: string) => {
    try {
      const res = await fetch(`/api/v1/licences/${licenceId}/reveal-number`, {
        method: "POST",
      });
      if (res.ok) {
        const json = await res.json();
        setRevealedNumbers((prev) => ({ ...prev, [licenceId]: json.data.licenceNumber }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ticket alias ('EWP', 'Forklift ticket', 'First Aid')..."
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">All Licences</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">All Statuses</option>
            <option value="VALID">Valid Only</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="EXPIRED">Expired</option>
            <option value="PENDING_VERIFICATION">Pending</option>
          </select>

          <select
            value={selectedAvailability}
            onChange={(e) => setSelectedAvailability(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">Availability</option>
            <option value="AVAILABLE">Available</option>
            <option value="LIMITED">Limited</option>
            <option value="UNAVAILABLE">Unavailable</option>
          </select>

          <select
            value={expiringWithinDays}
            onChange={(e) => setExpiringWithinDays(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">Expiry Window</option>
            <option value="30">Within 30 Days</option>
            <option value="60">Within 60 Days</option>
            <option value="90">Within 90 Days</option>
          </select>

          <input
            type="date"
            value={validOnDate}
            onChange={(e) => setValidOnDate(e.target.value)}
            title="Valid on Date"
            className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          />
        </div>
      </div>

      {/* Directory Table / Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          title="No holders match your search"
          description="Try clearing some filter chips or searching for another alias such as 'Forklift', 'EWP' or 'HLTAID011'."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="px-4 py-3">Volunteer</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Licences & Tickets</th>
                  {canContact && <th className="px-4 py-3 text-right">Contact</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {people.map((person) => (
                  <tr key={person.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3.5 align-top">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {person.name}
                      </div>
                      {canContact && person.email && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {person.email}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      <Badge
                        variant={
                          person.availability?.status === "AVAILABLE"
                            ? "success"
                            : person.availability?.status === "LIMITED"
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {person.availability?.status || "AVAILABLE"}
                      </Badge>
                      {person.availability?.note && (
                        <div className="text-[11px] text-slate-500 max-w-[140px] truncate mt-0.5">
                          {person.availability.note}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 align-top">
                      <div className="flex flex-wrap gap-1.5">
                        {person.licences?.map((lic: any) => {
                          const isRevealed = revealedNumbers[lic.id];
                          const displayNumber = isRevealed || lic.maskedLicenceNumber || lic.licenceNumber;

                          return (
                            <div
                              key={lic.id}
                              className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg text-xs"
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {lic.licenceType?.name}
                              </span>
                              {lic.class && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  ({lic.class})
                                </span>
                              )}

                              <Badge
                                variant={
                                  lic.status === "VALID"
                                    ? "success"
                                    : lic.status === "EXPIRING_SOON"
                                    ? "warning"
                                    : "danger"
                                }
                                size="sm"
                              >
                                {lic.status === "EXPIRING_SOON" ? "Expiring" : lic.status}
                              </Badge>

                              {lic.expiryMonthYear && (
                                <span className="text-[11px] text-slate-400">
                                  {lic.expiryMonthYear}
                                </span>
                              )}

                              {canSensitiveView && lic.isMasked && !isRevealed && (
                                <button
                                  onClick={() => handleReveal(lic.id)}
                                  className="text-indigo-600 hover:text-indigo-700 ml-0.5"
                                  title="Reveal licence number (Audited)"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                              )}

                              {displayNumber && (
                                <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 ml-1">
                                  {displayNumber}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    {canContact && (
                      <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {person.phone && (
                            <a
                              href={`tel:${person.phone}`}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 transition-all"
                              title={`Call ${person.phone}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {person.email && (
                            <a
                              href={`mailto:${person.email}`}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-indigo-600 transition-all"
                              title={`Email ${person.email}`}
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 3. SUMMARY DASHBOARD TAB
// ==========================================
function SummaryTab() {
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedHoldersType, setSelectedHoldersType] = useState<any>(null);
  const [holdersList, setHoldersList] = useState<any[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);

  useEffect(() => {
    async function loadSummary() {
      try {
        const res = await fetch("/api/v1/licence-summary");
        if (res.ok) {
          const json = await res.json();
          setSummary(json.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadSummary();
  }, []);

  const openHoldersList = async (type: any) => {
    setSelectedHoldersType(type);
    setLoadingHolders(true);
    try {
      const res = await fetch(`/api/v1/licence-summary/${type.id}/holders`);
      if (res.ok) {
        const json = await res.json();
        setHoldersList(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHolders(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-slate-100 dark:bg-slate-800/40 rounded-2xl animate-pulse" />;
  }

  const counters = summary?.counters || {};
  const types = summary?.types || [];

  return (
    <div className="space-y-6">
      {/* Overview Stat Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Volunteers with Licences</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            {counters.totalPeopleWithLicence || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Total Valid Licences</span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {counters.totalValidLicences || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Expiring in 30 Days</span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {counters.totalExpiringSoon || 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-xs text-slate-500 font-medium">Below Target Types</span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {counters.totalBelowTargetTypes || 0}
          </div>
        </div>
      </div>

      {/* Licence Types Capacity Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((t: any) => {
          return (
            <div
              key={t.id}
              onClick={() => openHoldersList(t)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {t.name}
                    </h3>
                  </div>

                  {t.belowTarget && (
                    <Badge variant="danger" size="sm">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Below Target (-{t.shortfall})
                    </Badge>
                  )}
                </div>

                {/* Counts Breakdown */}
                <div className="grid grid-cols-4 gap-2 text-center my-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div>
                    <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                      {t.validHolders}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Valid</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                      {t.expiringSoon}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Expiring</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
                      {t.expired}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Expired</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-sky-600 dark:text-sky-400">
                      {t.pending}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">Pending</div>
                  </div>
                </div>

                {/* Target Progress Bar */}
                {t.minHoldersTarget ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-500">Target: {t.minHoldersTarget} holders</span>
                      <span className={t.belowTarget ? "text-rose-600" : "text-emerald-600"}>
                        {t.progressPercent}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          t.belowTarget ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, t.progressPercent)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 font-medium italic">
                    No minimum target set
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-indigo-600 dark:text-indigo-400 font-medium flex items-center justify-between">
                <span>View {t.validHolders} qualified holders</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Holders List Drilldown Modal */}
      {selectedHoldersType && (
        <Modal
          title={`Qualified Holders: ${selectedHoldersType.name}`}
          isOpen={true}
          onClose={() => setSelectedHoldersType(null)}
        >
          {loadingHolders ? (
            <div className="py-8 flex justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : holdersList.length === 0 ? (
            <p className="py-4 text-center text-slate-500 text-sm">
              No currently valid holders registered for this licence type.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {holdersList.map((lic) => (
                <div
                  key={lic.id}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs sm:text-sm"
                >
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {lic.user?.name}
                    </div>
                    <div className="text-slate-400 text-xs">
                      {lic.class ? `Class: ${lic.class}` : "Standard"} •{" "}
                      {lic.expiresAt
                        ? `Expires ${new Date(lic.expiresAt).toLocaleDateString("en-AU")}`
                        : "No Expiry"}
                    </div>
                  </div>

                  <Badge variant={lic.status === "VALID" ? "success" : "warning"} size="sm">
                    {lic.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ==========================================
// 4. FIND VOLUNTEERS TAB
// ==========================================
function FindVolunteersTab({ canContact }: { canContact: boolean }) {
  const [types, setTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [requirements, setRequirements] = useState<any[]>([]);
  const [onDate, setOnDate] = useState(new Date().toISOString().split("T")[0]);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadTypes() {
      const res = await fetch("/api/v1/licence-types?activeOnly=true");
      if (res.ok) {
        const json = await res.json();
        setTypes(json.data || []);
        if (json.data?.[0]) setSelectedTypeId(json.data[0].id);
      }
    }
    loadTypes();
  }, []);

  const addRequirement = () => {
    if (!selectedTypeId) return;
    const type = types.find((t) => t.id === selectedTypeId);
    setRequirements((prev) => [
      ...prev,
      {
        licenceTypeId: selectedTypeId,
        typeName: type?.name || "Licence",
        class: selectedClass || undefined,
        minHolders: 1,
      },
    ]);
  };

  const removeRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSearch = async () => {
    if (requirements.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/licence-find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements: requirements.map((r) => ({
            licenceTypeId: r.licenceTypeId,
            class: r.class,
            minHolders: r.minHolders,
          })),
          onDate,
          availability: availableOnly ? "AVAILABLE" : undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResults(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const copyVolunteersList = () => {
    if (!results?.candidates) return;
    const lines = results.candidates.map((c: any) => {
      const contactInfo = c.phone || c.email ? ` (${c.phone || ""} ${c.email || ""})` : "";
      return `- ${c.name}${contactInfo}: ${c.availability.status}`;
    });
    navigator.clipboard.writeText(`Eligible Volunteers for ${onDate}:\n` + lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSelectedType = types.find((t) => t.id === selectedTypeId);

  return (
    <div className="space-y-6">
      {/* Criteria Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Find Eligible & Available Volunteers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Rank volunteers by required tickets, availability, existing task commitments, and expiry dates.
          </p>
        </div>

        {/* Add Requirement Strip */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-end bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Required Licence
            </label>
            <select
              value={selectedTypeId}
              onChange={(e) => setSelectedTypeId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.category?.name})
                </option>
              ))}
            </select>
          </div>

          {currentSelectedType?.classes?.length > 0 && (
            <div className="w-full sm:w-44">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Class Required
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              >
                <option value="">Any Class</option>
                {currentSelectedType.classes.map((c: string) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button onClick={addRequirement} size="sm" type="button" icon={<Plus className="w-4 h-4" />}>
            Add Requirement
          </Button>
        </div>

        {/* Requirements Pills */}
        {requirements.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {requirements.map((req, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-semibold border border-indigo-200 dark:border-indigo-800"
              >
                {req.typeName} {req.class ? `(${req.class})` : ""}
                <button
                  onClick={() => removeRequirement(idx)}
                  className="hover:text-rose-600 ml-1"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Date and Availability Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-600 dark:text-slate-400">Target Date:</span>
              <input
                type="date"
                value={onDate}
                onChange={(e) => setOnDate(e.target.value)}
                className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
              />
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={(e) => setAvailableOnly(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              Available Only
            </label>
          </div>

          <Button
            onClick={handleSearch}
            isLoading={loading}
            disabled={requirements.length === 0}
            icon={<Search className="w-4 h-4" />}
          >
            Find Eligible People
          </Button>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {results.summaryText}
              </h3>
              <p className="text-xs text-slate-500">
                Ranked by qualification completeness, availability status, lowest 7-day seva load, and remaining validity.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={copyVolunteersList}
              icon={copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            >
              {copied ? "Copied List!" : "Copy List"}
            </Button>
          </div>

          {results.candidates?.length === 0 ? (
            <EmptyState
              title="No eligible volunteers found"
              description="No active volunteers hold all the selected licences valid on this date. Try removing class restrictions or searching for partial matches."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {results.candidates.map((c: any, index: number) => (
                <div
                  key={c.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 text-xs font-bold flex items-center justify-center">
                          #{index + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {c.name}
                          </h4>
                          <span className="text-xs text-slate-400">
                            Commitments: {c.openSevaCount} seva in next 7d
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant={
                          c.availability.status === "AVAILABLE"
                            ? "success"
                            : c.availability.status === "LIMITED"
                            ? "warning"
                            : "danger"
                        }
                        size="sm"
                      >
                        {c.availability.status}
                      </Badge>
                    </div>

                    {/* Licences held matching requirements */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {c.licences?.map((lic: any) => (
                        <Badge key={lic.id} variant="default" size="sm">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />
                          {lic.licenceType?.name} {lic.class ? `(${lic.class})` : ""}
                        </Badge>
                      ))}
                    </div>

                    {c.availability.note && (
                      <p className="mt-2 text-xs text-slate-500 italic">
                        "{c.availability.note}"
                      </p>
                    )}
                  </div>

                  {canContact && (c.phone || c.email) && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="text-xs text-slate-500">
                        {c.phone || c.email}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {c.phone && (
                          <a
                            href={`tel:${c.phone}`}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg hover:text-indigo-600"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="p-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg hover:text-indigo-600"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==========================================
// 5. MATRIX TAB
// ==========================================
function MatrixTab() {
  const [matrix, setMatrix] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchMatrix = async () => {
    setLoading(true);
    try {
      const url = selectedCategory
        ? `/api/v1/licence-matrix?categoryId=${selectedCategory}`
        : `/api/v1/licence-matrix`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setMatrix(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function loadCats() {
      const res = await fetch("/api/v1/licence-categories");
      if (res.ok) setCategories((await res.json()).data || []);
    }
    loadCats();
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [selectedCategory]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Licence & Competencies Matrix
          </h2>
          <p className="text-xs text-slate-500">
            Cross-tabulation of people across all recognised licence types.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/v1/licence-reports/export?reportType=MATRIX&format=csv", "_blank")}
            icon={<Download className="w-4 h-4" />}
          >
            Export Matrix
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 bg-slate-100 dark:bg-slate-800/40 rounded-2xl animate-pulse" />
      ) : !matrix?.rows?.length ? (
        <EmptyState title="No matrix data available" description="No users currently hold registered licences." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-20 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-slate-100 dark:bg-slate-800 z-30 min-w-[180px] shadow-sm">
                    Person Name
                  </th>
                  {matrix.columns?.map((col: any) => (
                    <th key={col.id} className="px-3 py-3 text-center min-w-[110px] whitespace-nowrap">
                      {col.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {matrix.rows.map((row: any) => (
                  <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-sm whitespace-nowrap">
                      {row.userName}
                    </td>

                    {matrix.columns?.map((col: any) => {
                      const cell = row.cells?.[col.id];
                      if (!cell || cell.status === "NONE") {
                        return (
                          <td key={col.id} className="px-3 py-2.5 text-center text-slate-300 dark:text-slate-700 font-mono">
                            —
                          </td>
                        );
                      }

                      let bg = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                      if (cell.status === "EXPIRING_SOON") bg = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
                      else if (cell.status === "EXPIRED") bg = "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
                      else if (cell.status === "PENDING_VERIFICATION") bg = "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";

                      return (
                        <td key={col.id} className="px-2 py-2 text-center whitespace-nowrap">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${bg}`}>
                            {cell.class || cell.status}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 6. VERIFICATION QUEUE TAB
// ==========================================
function VerificationQueueTab() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [rejectionModalLicence, setRejectionModalLicence] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/licences/pending");
      if (res.ok) {
        const json = await res.json();
        setQueue(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  const handleVerify = async (licenceId: string, expectedVersion: number) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/v1/licences/${licenceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "VALID", expectedVersion }),
      });
      if (res.ok) {
        setSelectedSubmission(null);
        fetchQueue();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionModalLicence || !rejectionReason.trim()) return;
    setVerifying(true);
    try {
      const res = await fetch(`/api/v1/licences/${rejectionModalLicence.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason,
          expectedVersion: rejectionModalLicence.version,
        }),
      });
      if (res.ok) {
        setRejectionModalLicence(null);
        setRejectionReason("");
        setSelectedSubmission(null);
        fetchQueue();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Pending Verification Queue ({queue.length})
        </h2>
        <p className="text-xs text-slate-500">
          Review self-submitted licences and inspect documents before approving.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 bg-slate-100 dark:bg-slate-800/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title="Verification queue is clear"
          description="There are no pending licence submissions waiting for administrative verification."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {queue.map((sub) => (
            <div
              key={sub.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {sub.user?.name}
                    </h3>
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {sub.licenceType?.name} {sub.class ? `(${sub.class})` : ""}
                    </span>
                  </div>
                  <Badge variant="info" size="sm">
                    Pending
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Number:</span>
                    <span className="font-mono">{sub.licenceNumber || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Expiry:</span>
                    <span>
                      {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString("en-AU") : "No Expiry"}
                    </span>
                  </div>
                </div>

                {sub.notes && (
                  <p className="mt-2 text-xs text-slate-500 italic bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg">
                    "{sub.notes}"
                  </p>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRejectionModalLicence(sub)}
                  className="text-rose-600 hover:text-rose-700"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleVerify(sub.id, sub.version)}
                  isLoading={verifying}
                  icon={<Check className="w-4 h-4" />}
                >
                  Verify & Approve
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectionModalLicence && (
        <Modal
          title={`Reject ${rejectionModalLicence.licenceType?.name} Submission`}
          isOpen={true}
          onClose={() => setRejectionModalLicence(null)}
        >
          <div className="space-y-4 text-xs sm:text-sm">
            <p className="text-slate-500">
              Please provide a clear reason for the rejection. The volunteer will be notified.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="e.g. Unreadable scan of document / Expired certificate / Incorrect class selected..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRejectionModalLicence(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                isLoading={verifying}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ==========================================
// 7. LICENCE TYPES TAB
// ==========================================
function LicenceTypesTab() {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTypes() {
      try {
        const res = await fetch("/api/v1/licence-types?activeOnly=false");
        if (res.ok) setTypes((await res.json()).data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadTypes();
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Master Licence Types & Categories ({types.length})
        </h2>
        <p className="text-xs text-slate-500">
          Admin configuration of recognised tickets, validity defaults, classes, and target holder counts.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Type Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Classes</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Privacy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                    {t.name}
                    <div className="text-[11px] font-mono text-slate-400">{t.code}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {t.category?.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral" size="sm">{t.kind}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {t.classes?.length > 0 ? t.classes.join(", ") : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {t.minHoldersTarget ? `${t.minHoldersTarget} holders` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {t.isHighlySensitive ? (
                      <Badge variant="danger" size="sm">Highly Sensitive</Badge>
                    ) : (
                      <span className="text-slate-400">Standard</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 8. CSV IMPORT TAB
// ==========================================
function ImportTab() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    setSuccessCount(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/licences/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Preview failed");
      }

      const json = await res.json();
      setPreview(json.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!preview?.rows) return;
    setCommitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/licences/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows.map((r: any) => r.data),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error?.message || "Commit failed");
      }

      const json = await res.json();
      setSuccessCount(json.data.importedCount);
      setPreview(null);
      setFile(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Bulk Import Licences via CSV
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload volunteer licences in bulk. Matches volunteers by email address.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("/api/v1/licences/import/template", "_blank")}
            icon={<Download className="w-4 h-4" />}
          >
            Download CSV Template
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl border border-rose-200 text-xs">
            {error}
          </div>
        )}

        {successCount !== null && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-200 text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            Successfully imported {successCount} licences into the database!
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 dark:file:bg-indigo-950 dark:file:text-indigo-300"
          />

          <Button
            onClick={handlePreview}
            disabled={!file}
            isLoading={loading}
            size="sm"
          >
            Upload & Preview
          </Button>
        </div>
      </div>

      {/* Preview Section */}
      {preview && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Import Preview ({preview.validCount} Valid, {preview.errorCount} Errors)
              </h3>
              <p className="text-xs text-slate-500">
                All-or-nothing: All row errors must be resolved before committing.
              </p>
            </div>

            <Button
              onClick={handleCommit}
              disabled={!preview.canCommit}
              isLoading={committing}
              size="sm"
              icon={<Check className="w-4 h-4" />}
            >
              Commit Import ({preview.validCount} Rows)
            </Button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold sticky top-0">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Licence Code</th>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Validation Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.map((row: any) => (
                  <tr
                    key={row.rowNumber}
                    className={row.isValid ? "bg-white dark:bg-slate-900" : "bg-rose-50/50 dark:bg-rose-950/20"}
                  >
                    <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">{row.data.userEmail}</td>
                    <td className="px-3 py-2 font-mono">{row.data.licenceTypeCode}</td>
                    <td className="px-3 py-2">{row.data.class || "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.isValid ? "success" : "danger"} size="sm">
                        {row.isValid ? "Valid" : "Error"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-rose-600 dark:text-rose-400">
                      {row.errors?.join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
