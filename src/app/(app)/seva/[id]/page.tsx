"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Calendar,
  Clock,
  Star,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Download,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Layers,
  FolderTree,
  Archive,
  MessageSquare,
  Activity,
  Send,
  Move,
  CheckSquare,
  Briefcase,
  ShieldAlert,
  ExternalLink,
  Award,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Tabs } from "@/core/ui-kit/Tabs";
import { FileUploader } from "@/core/ui-kit/FileUploader";
import { ConfirmDialog } from "@/core/ui-kit/ConfirmDialog";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField } from "@/core/ui-kit/FormField";
import { SevaFormModal } from "@/modules/seva/components/SevaFormModal";
import { useCurrentUser } from "@/core/auth/useCurrentUser";
import { format } from "date-fns";

export default function SevaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const sevaId = resolvedParams.id;
  const router = useRouter();

  const [seva, setSeva] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [files, setFiles] = useState<any[]>([]);
  const [quotesComparison, setQuotesComparison] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [rollup, setRollup] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [isConvertGroupOpen, setIsConvertGroupOpen] = useState(false);

  const { hasPermission } = useCurrentUser();
  const canAssignContractors = hasPermission("contractors.assign");
  const canReadFullContractors = hasPermission("contractors.readFull");

  const [contractorsEnabled, setContractorsEnabled] = useState(true);
  const [sevaContractors, setSevaContractors] = useState<any[]>([]);
  const [allContractors, setAllContractors] = useState<any[]>([]);
  const [contractorSuggestions, setContractorSuggestions] = useState<any[]>([]);
  const [isAddContractorOpen, setIsAddContractorOpen] = useState(false);
  const [selectedContractorToAdd, setSelectedContractorToAdd] = useState<any>(null);
  const [contractorForm, setContractorForm] = useState({
    role: "PRIMARY",
    scope: "",
    quotedAmount: "",
    finalAmount: "",
    invoiceNumber: "",
    invoicedAmount: "",
  });
  const [isComplianceWarningOpen, setIsComplianceWarningOpen] = useState(false);
  const [complianceWarningMsg, setComplianceWarningMsg] = useState("");
  const [engagePrompt, setEngagePrompt] = useState<{
    quoteId: string;
    contractorId: string;
    contractorName: string;
    amount: number;
  } | null>(null);

  // Licences integration
  const canRequireLicences = hasPermission("licences.seva.require");
  const [licencesEnabled, setLicencesEnabled] = useState(true);
  const [licenceCheck, setLicenceCheck] = useState<any>(null);
  const [requiredLicences, setRequiredLicences] = useState<any[]>([]);
  const [isEditReqModalOpen, setIsEditReqModalOpen] = useState(false);
  const [allLicenceTypes, setAllLicenceTypes] = useState<any[]>([]);
  const [newReqTypeId, setNewReqTypeId] = useState("");
  const [newReqClass, setNewReqClass] = useState("");
  const [newReqMinHolders, setNewReqMinHolders] = useState(1);

  const loadLicences = async () => {
    try {
      const checkRes = await fetch(`/api/v1/seva/${sevaId}/licence-check`);
      if (checkRes.status === 404) {
        setLicencesEnabled(false);
        return;
      }
      if (checkRes.ok) {
        const j = await checkRes.json();
        setLicenceCheck(j.data);
      }
      const reqRes = await fetch(`/api/v1/seva/${sevaId}/required-licences`);
      if (reqRes.ok) {
        const rj = await reqRes.json();
        setRequiredLicences(rj.data || []);
      }
      const typesRes = await fetch("/api/v1/licence-types");
      if (typesRes.ok) {
        const tj = await typesRes.json();
        setAllLicenceTypes(tj.data || []);
        if (tj.data?.[0]) setNewReqTypeId(tj.data[0].id);
      }
    } catch {}
  };

  const loadSeva = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}`);
      if (res.ok) {
        const json = await res.json();
        setSeva(json.data);

        if (json.data.isGroup) {
          // Load roll-up
          const rRes = await fetch(`/api/v1/seva/${sevaId}/rollup`);
          if (rRes.ok) {
            const rJson = await rRes.json();
            setRollup(rJson.data);
          }
        }
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  const loadContractors = async () => {
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/contractors`);
      if (res.status === 404) {
        setContractorsEnabled(false);
        return;
      }
      if (res.ok) {
        const j = await res.json();
        setSevaContractors(j.data || []);
      }
      const sugRes = await fetch(`/api/v1/seva/${sevaId}/contractors/suggestions`);
      if (sugRes.ok) {
        const sj = await sugRes.json();
        setContractorSuggestions(sj.data || []);
      }
      const cRes = await fetch("/api/v1/contractors?limit=100");
      if (cRes.ok) {
        const cj = await cRes.json();
        setAllContractors(cj.data || []);
      }
    } catch {}
  };

  const loadFiles = async () => {
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/files`);
      if (res.ok) {
        const json = await res.json();
        setFiles(json.data || []);
      }
      const qRes = await fetch(`/api/v1/seva/${sevaId}/quotes/compare`);
      if (qRes.ok) {
        const qJson = await qRes.json();
        setQuotesComparison(qJson.data);
      }
    } catch {}
  };

  const loadComments = async () => {
    try {
      const res = await fetch(`/api/v1/comments?entityId=${sevaId}`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadSeva();
    loadFiles();
    loadComments();
    loadContractors();
    loadLicences();
  }, [sevaId]);

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReqTypeId) return;
    const existing = requiredLicences.map((r) => ({
      licenceTypeId: r.licenceTypeId,
      classRequired: r.classRequired || undefined,
      minHolders: r.minHolders || 1,
    }));
    const updated = [
      ...existing,
      {
        licenceTypeId: newReqTypeId,
        classRequired: newReqClass.trim() || undefined,
        minHolders: Number(newReqMinHolders) || 1,
      },
    ];
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/required-licences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: updated }),
      });
      if (res.ok) {
        setNewReqClass("");
        setNewReqMinHolders(1);
        loadLicences();
      }
    } catch {}
  };

  const handleRemoveRequirement = async (reqId: string) => {
    const updated = requiredLicences
      .filter((r) => r.id !== reqId)
      .map((r) => ({
        licenceTypeId: r.licenceTypeId,
        classRequired: r.classRequired || undefined,
        minHolders: r.minHolders || 1,
      }));
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/required-licences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirements: updated }),
      });
      if (res.ok) {
        loadLicences();
      }
    } catch {}
  };

  const handleToggleChecklist = async (occurrenceId: string, checklistItemId: string, isCompleted: boolean) => {
    try {
      await fetch(`/api/v1/occurrences/${occurrenceId}/checklists/${checklistItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted }),
      });
      loadSeva();
    } catch {}
  };

  const handleToggleWatcher = async () => {
    try {
      await fetch(`/api/v1/seva/${sevaId}/watchers`, { method: "POST" });
      loadSeva();
    } catch {}
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const res = await fetch("/api/v1/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "SEVA",
          entityId: sevaId,
          body: newComment.trim(),
        }),
      });
      if (res.ok) {
        setNewComment("");
        loadComments();
      }
    } catch {}
  };

  const handleApproveQuote = async (fileId: string) => {
    try {
      const res = await fetch(`/api/v1/files/${fileId}/approve-quote`, { method: "POST" });
      if (res.ok) {
        loadSeva();
        loadFiles();
        const q = files.find((f) => f.id === fileId);
        if (q?.contractorId) {
          const matchedC = allContractors.find((c) => c.id === q.contractorId);
          setEngagePrompt({
            quoteId: fileId,
            contractorId: q.contractorId,
            contractorName: matchedC?.companyName || q.supplierName || "Contractor",
            amount: q.amount || 0,
          });
        }
      }
    } catch {}
  };

  const handleConfirmEngage = async () => {
    if (!engagePrompt) return;
    try {
      const existing = sevaContractors.find((c) => c.contractorId === engagePrompt.contractorId);
      const updatedList = existing
        ? sevaContractors.map((c) =>
            c.contractorId === engagePrompt.contractorId
              ? { ...c, status: "ENGAGED", quotedAmount: engagePrompt.amount }
              : c
          )
        : [
            ...sevaContractors,
            {
              contractorId: engagePrompt.contractorId,
              role: "PRIMARY",
              status: "ENGAGED",
              quotedAmount: engagePrompt.amount,
            },
          ];

      await fetch(`/api/v1/seva/${sevaId}/contractors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractors: updatedList }),
      });
      loadContractors();
    } catch {} finally {
      setEngagePrompt(null);
    }
  };

  const handleSelectContractorToAdd = (c: any) => {
    setSelectedContractorToAdd(c);
    const isBlocked = c.status === "BLOCKED";
    const hasInsurance = c.hasValidInsurance;

    if (isBlocked || !hasInsurance) {
      let msg = "";
      if (isBlocked && !hasInsurance) {
        msg = `Warning: ${c.companyName} is currently BLOCKED and has NO VALID INSURANCE.`;
      } else if (isBlocked) {
        msg = `Warning: ${c.companyName} is currently marked as BLOCKED (${c.blockedReason || "on hold"}).`;
      } else {
        msg = `Warning: ${c.companyName} does NOT have current valid insurance recorded.`;
      }
      setComplianceWarningMsg(`${msg} Engaging this contractor requires coordinator override and will be logged in the activity audit.`);
      setIsComplianceWarningOpen(true);
    }
  };

  const handleSaveContractorToSeva = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContractorToAdd) return;

    try {
      const newEntry = {
        contractorId: selectedContractorToAdd.id,
        role: contractorForm.role,
        scope: contractorForm.scope || undefined,
        quotedAmount: contractorForm.quotedAmount ? Number(contractorForm.quotedAmount) : undefined,
        finalAmount: contractorForm.finalAmount ? Number(contractorForm.finalAmount) : undefined,
        invoiceNumber: contractorForm.invoiceNumber || undefined,
        invoicedAmount: contractorForm.invoicedAmount ? Number(contractorForm.invoicedAmount) : undefined,
      };

      const updatedList = [
        ...sevaContractors.filter((c) => c.contractorId !== selectedContractorToAdd.id),
        newEntry,
      ];

      const res = await fetch(`/api/v1/seva/${sevaId}/contractors`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractors: updatedList }),
      });

      if (res.ok) {
        setIsAddContractorOpen(false);
        setSelectedContractorToAdd(null);
        setContractorForm({
          role: "PRIMARY",
          scope: "",
          quotedAmount: "",
          finalAmount: "",
          invoiceNumber: "",
          invoicedAmount: "",
        });
        loadContractors();
      }
    } catch {}
  };

  const handleRevokeQuote = async (fileId: string) => {
    try {
      const res = await fetch(`/api/v1/files/${fileId}/revoke-quote`, { method: "POST" });
      if (res.ok) {
        loadSeva();
        loadFiles();
      }
    } catch {}
  };

  const handleArchive = async () => {
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/archive`, { method: "POST" });
      if (res.ok) {
        router.push("/seva");
      }
    } catch {}
  };

  const handleConvertGroup = async () => {
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/convert-group`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: seva.version }),
      });
      if (res.ok) {
        setIsConvertGroupOpen(false);
        loadSeva();
      }
    } catch {}
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/v1/seva/${sevaId}/duplicate`, { method: "POST" });
      if (res.ok) {
        const json = await res.json();
        router.push(`/seva/${json.data.id}`);
      }
    } catch {}
  };

  if (isLoading || !seva) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading seva details...</div>;
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "files", label: "Files & Quotes", count: files.length },
    ...(contractorsEnabled ? [{ id: "contractors", label: "Contractors", count: sevaContractors.length }] : []),
    ...(seva.isGroup ? [{ id: "subseva", label: "Sub-Seva Tree", count: seva.children?.length }] : []),
    { id: "comments", label: "Comments", count: comments.length },
  ];

  const quotes = files.filter((f) => f.bucket === "QUOTE");
  const artefacts = files.filter((f) => f.bucket === "ARTEFACT");

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto pb-1">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/seva" className="hover:underline">
          Seva
        </Link>
        {seva.ancestors?.map((anc: any) => (
          <React.Fragment key={anc.id}>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <Link href={`/seva/${anc.id}`} className="hover:underline truncate max-w-[120px]">
              {anc.code}
            </Link>
          </React.Fragment>
        ))}
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{seva.code}</span>
      </div>

      {/* Main Header Card */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60">
                {seva.code}
              </span>
              <Badge size="sm" variant={seva.priority === "URGENT" ? "danger" : "info"}>
                {seva.priority}
              </Badge>
              <Badge size="sm" variant="neutral">
                {seva.category?.name}
              </Badge>
              <Badge size="sm" variant="neutral">
                {seva.area?.name}
              </Badge>
              {seva.isGroup && (
                <Badge size="sm" variant="default" className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                  Project Group
                </Badge>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{seva.title}</h1>

            <div className="text-xs text-slate-500 mt-2 flex flex-wrap items-center gap-4">
              {seva.dueDate && <span>Due: {format(new Date(seva.dueDate), "dd MMMM yyyy")}</span>}
              {seva.approvedBudget && (
                <span className="text-emerald-600 font-semibold">
                  Approved Budget: ${Number(seva.approvedBudget).toLocaleString()} AUD
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleToggleWatcher} icon={<Eye className="w-3.5 h-3.5" />}>
              Watch
            </Button>
            <Button size="sm" variant="outline" onClick={handleDuplicate} icon={<Copy className="w-3.5 h-3.5" />}>
              Duplicate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditModalOpen(true)} icon={<Edit2 className="w-3.5 h-3.5" />}>
              Edit
            </Button>
            {!seva.isGroup && seva.kind !== "RECURRING" && (
              <Button size="sm" variant="secondary" onClick={() => setIsConvertGroupOpen(true)} icon={<Layers className="w-3.5 h-3.5" />}>
                Make Group
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setIsArchiveConfirmOpen(true)} icon={<Archive className="w-3.5 h-3.5" />}>
              Archive
            </Button>
          </div>
        </div>

        {/* Group Roll-up Progress Bar */}
        {seva.isGroup && rollup && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
              <span>Overall Project Progress</span>
              <span className="font-bold text-indigo-600">{rollup.progressPercent}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${rollup.progressPercent}%` }} />
            </div>
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>{rollup.descendantCount} sub-tasks</span>
              <span>
                {rollup.doneOccurrences} done • {rollup.inProgressOccurrences} in progress • {rollup.overdueOccurrences} overdue
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Licence Compliance Banner */}
      {licencesEnabled && licenceCheck?.hasRequirements && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
            licenceCheck.isCompliant
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
              : licenceCheck.enforcementMode === "BLOCK"
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {licenceCheck.isCompliant ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle
                className={`w-5 h-5 shrink-0 ${
                  licenceCheck.enforcementMode === "BLOCK"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              />
            )}
            <div>
              <span className="font-bold">
                {licenceCheck.isCompliant ? "Licence Compliance Verified" : "Licence Compliance Alert"}
              </span>
              <p className="text-[11px] opacity-90 mt-0.5">{licenceCheck.bannerMessage}</p>
            </div>
          </div>
          <Badge
            size="sm"
            variant={licenceCheck.isCompliant ? "success" : licenceCheck.enforcementMode === "BLOCK" ? "danger" : "warning"}
          >
            {licenceCheck.isCompliant
              ? "COMPLIANT"
              : licenceCheck.enforcementMode === "BLOCK"
              ? "ASSIGNMENT BLOCKED"
              : "ACTION REQUIRED"}
          </Badge>
        </div>
      )}

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Description Card */}
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Scope & Description</h2>
              <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {seva.description}
              </p>
            </div>

            {/* Checklist */}
            {seva.checklistItems && seva.checklistItems.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Standard Checklist ({seva.checklistItems.length})
                </h2>
                <div className="space-y-1.5">
                  {seva.checklistItems.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-xs">
                      <CheckCircle2 className="w-4 h-4 text-slate-400" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Occurrences List */}
            {seva.occurrences && seva.occurrences.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Work Occurrences ({seva.occurrences.length})
                </h2>
                <div className="space-y-2">
                  {seva.occurrences.map((occ: any) => (
                    <div
                      key={occ.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          Due: {format(new Date(occ.dueDate), "dd MMM yyyy")}
                        </span>
                        <Badge size="sm" variant={occ.status === "DONE" ? "success" : occ.status === "IN_PROGRESS" ? "info" : "warning"}>
                          {occ.status}
                        </Badge>
                      </div>

                      {/* Checklist inside occurrence */}
                      {occ.checklists && occ.checklists.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                          {occ.checklists.map((c: any) => (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={c.isCompleted}
                                onChange={(e) => handleToggleChecklist(occ.id, c.checklistItemId, e.target.checked)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className={c.isCompleted ? "line-through text-slate-400" : ""}>
                                {c.checklistItem?.text}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar: Assignees & Watchers */}
          <div className="space-y-4">
            {/* Required Licences Card */}
            {licencesEnabled && (
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Required Licences ({requiredLicences.length})
                  </h2>
                  {canRequireLicences && (
                    <button
                      type="button"
                      onClick={() => setIsEditReqModalOpen(true)}
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Manage
                    </button>
                  )}
                </div>

                {requiredLicences.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No special tickets or licences required for this task.</p>
                ) : (
                  <div className="space-y-2">
                    {requiredLicences.map((req) => {
                      const evalReq = licenceCheck?.requirements?.find((r: any) => r.requirementId === req.id);
                      const isMet = evalReq?.isMet;
                      return (
                        <div
                          key={req.id}
                          className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {req.licenceType?.name}
                              {req.classRequired ? ` (${req.classRequired})` : ""}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Target: at least {req.minHolders} holder{req.minHolders > 1 ? "s" : ""}
                            </div>
                          </div>
                          {evalReq && (
                            <Badge size="sm" variant={isMet ? "success" : "warning"}>
                              {evalReq.currentHoldersCount} / {req.minHolders} met
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Assignees ({seva.assignees?.length || 0})
                </h2>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Edit
                </button>
              </div>
              <div className="space-y-2">
                {(!seva.assignees || seva.assignees.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No assignees yet. Click &ldquo;Edit&rdquo; to assign members.</p>
                ) : (
                  seva.assignees.map((a: any) => {
                    const heldReqs = licenceCheck?.requirements?.filter((r: any) =>
                      r.holders?.some((h: any) => h.userId === a.user.id)
                    );
                    const hasReqs = licenceCheck?.hasRequirements;

                    return (
                      <div key={a.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
                            {a.user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{a.user.name}</div>
                            <div className="text-[10px] text-slate-400">{a.user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {licencesEnabled && hasReqs && (
                            heldReqs && heldReqs.length > 0 ? (
                              <span
                                title={`Holds required licence: ${heldReqs.map((r: any) => r.licenceTypeName).join(", ")}`}
                                className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded"
                              >
                                <Award className="w-3 h-3 text-emerald-600" />
                                {heldReqs[0].licenceTypeName}
                              </span>
                            ) : (
                              <span
                                title="Assignee does not hold a valid required licence for this task"
                                className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded"
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-500" />
                                Unlicensed
                              </span>
                            )
                          )}
                          {a.isLead && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded">
                              <Star className="w-3 h-3 fill-current" /> Lead
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Watchers ({seva.watchers?.length || 0})
              </h2>
              <div className="space-y-1.5 text-xs">
                {seva.watchers?.map((w: any) => (
                  <div key={w.id} className="text-slate-700 dark:text-slate-300">
                    {w.user.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Files & Quotes */}
      {activeTab === "files" && (
        <div className="space-y-5">
          {/* Compare Quotes Card (Screen 7) */}
          {quotesComparison && quotesComparison.quotes?.length > 0 && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Compare Quotations ({quotesComparison.quotes.length})
                </h2>
                {quotesComparison.lowestAmount && (
                  <span className="text-xs font-semibold text-emerald-600">
                    Lowest Quote: ${quotesComparison.lowestAmount.toLocaleString()} AUD
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {quotesComparison.quotes.map((q: any) => (
                  <div
                    key={q.id}
                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-all ${
                      q.quoteStatus === "APPROVED"
                        ? "border-emerald-500 bg-emerald-50/20"
                        : q.isLowest
                        ? "border-amber-400 bg-amber-50/10"
                        : "border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{q.supplierName || "Supplier"}</span>
                        {q.quoteStatus === "APPROVED" ? (
                          <Badge size="sm" variant="success">APPROVED</Badge>
                        ) : q.isLowest ? (
                          <Badge size="sm" variant="warning">LOWEST</Badge>
                        ) : null}
                      </div>

                      <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                        ${q.amount ? q.amount.toLocaleString() : "N/A"}{" "}
                        <span className="text-xs font-normal text-slate-400">{q.currency}</span>
                      </div>

                      {q.notes && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{q.notes}</p>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <a
                        href={`/api/v1/files/${q.id}/download`}
                        target="_blank"
                        className="text-indigo-600 hover:underline flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>

                      {q.quoteStatus !== "APPROVED" ? (
                        <Button size="sm" variant="primary" onClick={() => handleApproveQuote(q.id)}>
                          Approve Quote
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleRevokeQuote(q.id)}>
                          Revoke Approval
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Widget */}
          <FileUploader
            bucket="ARTEFACT"
            allowBucketSwitch
            onUpload={async (uploadFiles, b) => {
              const fd = new FormData();
              fd.set("bucket", b);
              uploadFiles.forEach((f) => fd.append("files", f));
              await fetch(`/api/v1/seva/${sevaId}/files`, {
                method: "POST",
                body: fd,
              });
              loadFiles();
            }}
          />

          {/* Artefacts & Documents List */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Uploaded Artefacts & Proof ({artefacts.length})
              </h2>
              <a
                href={`/api/v1/seva/${sevaId}/files.zip`}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download All ZIP
              </a>
            </div>

            {artefacts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No artefacts or photos uploaded yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {artefacts.map((art) => (
                  <div
                    key={art.id}
                    className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                  >
                    <div>
                      {art.fileObject.mimeType.startsWith("image/") ? (
                        <img
                          src={`/api/v1/files/${art.id}/download`}
                          alt={art.caption || "Artefact"}
                          className="w-full h-24 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-24 bg-indigo-50 dark:bg-slate-700 rounded-lg flex items-center justify-center text-indigo-500">
                          <FileText className="w-8 h-8" />
                        </div>
                      )}
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-1.5">
                        {art.fileObject.originalName}
                      </div>
                      {art.caption && <div className="text-[10px] text-slate-500 truncate">{art.caption}</div>}
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                      <span>{art.stage}</span>
                      <a href={`/api/v1/files/${art.id}/download`} download className="text-indigo-600 hover:underline">
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Contractors */}
      {activeTab === "contractors" && contractorsEnabled && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Engaged Contractors & Service Providers ({sevaContractors.length})
              </h2>
              <p className="text-xs text-slate-400">
                Companies and tradespeople engaged for this seva maintenance task.
              </p>
            </div>
            {canAssignContractors && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setSelectedContractorToAdd(null);
                  setContractorForm({
                    role: "PRIMARY",
                    scope: "",
                    quotedAmount: "",
                    finalAmount: "",
                    invoiceNumber: "",
                    invoicedAmount: "",
                  });
                  setIsAddContractorOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Assign Contractor
              </Button>
            )}
          </div>

          {sevaContractors.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <Briefcase className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs text-slate-500">No contractors currently engaged on this seva.</p>
              {canAssignContractors && (
                <Button size="sm" variant="secondary" onClick={() => setIsAddContractorOpen(true)}>
                  Find & Assign Contractor
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {sevaContractors.map((sc) => {
                const c = sc.contractor;
                const isBlocked = c?.status === "BLOCKED";
                return (
                  <div
                    key={sc.id || sc.contractorId}
                    className={`p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isBlocked ? "border-rose-300 dark:border-rose-900" : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/contractors/${sc.contractorId}`}
                          className="font-bold text-xs sm:text-sm text-indigo-600 hover:underline flex items-center gap-1"
                        >
                          {c?.companyName || "Contractor"} [{c?.code || "CON"}] <ExternalLink className="w-3 h-3" />
                        </Link>
                        <Badge size="sm" variant="neutral">{sc.role}</Badge>
                        <Badge size="sm" variant={sc.status === "COMPLETED" ? "success" : sc.status === "ENGAGED" ? "info" : "warning"}>
                          {sc.status}
                        </Badge>
                        {isBlocked && (
                          <Badge size="sm" variant="danger">
                            BLOCKED
                          </Badge>
                        )}
                      </div>

                      {sc.scope && <p className="text-xs text-slate-500 italic">Scope: {sc.scope}</p>}

                      {canReadFullContractors && (
                        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-600 dark:text-slate-400 pt-1">
                          {sc.quotedAmount != null && <span>Quoted: ${Number(sc.quotedAmount).toFixed(2)}</span>}
                          {sc.finalAmount != null && <span>Final: ${Number(sc.finalAmount).toFixed(2)}</span>}
                          {sc.invoiceNumber && <span>Inv #: {sc.invoiceNumber}</span>}
                          {sc.invoicedAmount != null && (
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              Invoiced: ${Number(sc.invoicedAmount).toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {canAssignContractors && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-500 self-end sm:self-center"
                        onClick={async () => {
                          if (!confirm("Remove this contractor from this seva?")) return;
                          const updated = sevaContractors.filter((x) => x.contractorId !== sc.contractorId);
                          await fetch(`/api/v1/seva/${sevaId}/contractors`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ contractors: updated }),
                          });
                          loadContractors();
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Sub-Seva Tree (For Groups) */}
      {activeTab === "subseva" && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Child Sub-Seva Nodes ({seva.children?.length || 0})
            </h2>
            <Button size="sm" variant="primary" onClick={() => setIsEditModalOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              Add Sub-Seva
            </Button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {seva.children?.map((child: any) => (
              <Link
                key={child.id}
                href={`/seva/${child.id}`}
                className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-indigo-600 mr-2">{child.code}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{child.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge size="sm" variant="neutral">{child.priority}</Badge>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Comments */}
      {activeTab === "comments" && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Activity & Discussion ({comments.length})
          </h2>

          <form onSubmit={handlePostComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Write a comment or mention team members with @Name..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
            />
            <Button type="submit" variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" />}>
              Post
            </Button>
          </form>

          <div className="space-y-3">
            {comments.map((c) => (
              <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">{c.user.name}</span>
                  <span className="text-[10px] text-slate-400">{format(new Date(c.createdAt), "dd MMM HH:mm")}</span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Contractor Modal */}
      {isAddContractorOpen && (
        <Modal
          isOpen={isAddContractorOpen}
          onClose={() => setIsAddContractorOpen(false)}
          title="Assign Contractor to Seva"
        >
          <form onSubmit={handleSaveContractorToSeva} className="space-y-4 text-xs">
            {/* Category-based Suggestions */}
            {contractorSuggestions.length > 0 && !selectedContractorToAdd && (
              <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-2">
                <span className="font-semibold text-indigo-900 dark:text-indigo-200 block text-[11px]">
                  Recommended for &ldquo;{seva.category?.name || "this task"}&rdquo;:
                </span>
                <div className="space-y-1.5">
                  {contractorSuggestions.slice(0, 3).map((sug) => (
                    <div
                      key={sug.id}
                      onClick={() => handleSelectContractorToAdd(sug)}
                      className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-between cursor-pointer hover:border-indigo-500"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {sug.companyName}
                        </span>
                        {sug.isPreferred && (
                          <span className="ml-1 text-[10px] text-indigo-600 font-semibold">(Preferred)</span>
                        )}
                        <div className="text-[10px] text-slate-400">
                          Rating: {sug.averageRating ? sug.averageRating.toFixed(1) : "—"} / 5
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="ghost" className="text-indigo-600">
                        Select
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contractor Picker */}
            <FormField label="Select Contractor" required>
              <select
                required
                value={selectedContractorToAdd?.id || ""}
                onChange={(e) => {
                  const found = allContractors.find((c) => c.id === e.target.value);
                  if (found) handleSelectContractorToAdd(found);
                }}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900"
              >
                <option value="">-- Choose from Directory --</option>
                {allContractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName} [{c.code}] {c.isPreferred ? "★ Preferred" : ""}
                  </option>
                ))}
              </select>
            </FormField>

            {selectedContractorToAdd && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Role in Task">
                    <select
                      value={contractorForm.role}
                      onChange={(e) => setContractorForm({ ...contractorForm, role: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900"
                    >
                      <option value="PRIMARY">Primary Contractor</option>
                      <option value="SUBCONTRACTOR">Subcontractor</option>
                      <option value="CONSULTANT">Consultant / Engineer</option>
                    </select>
                  </FormField>
                  <FormField label="Quoted Amount ($)">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={contractorForm.quotedAmount}
                      onChange={(e) => setContractorForm({ ...contractorForm, quotedAmount: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900"
                    />
                  </FormField>
                </div>

                <FormField label="Scope of Works">
                  <input
                    type="text"
                    placeholder="e.g. Roof membrane resealing and gutter clean"
                    value={contractorForm.scope}
                    onChange={(e) => setContractorForm({ ...contractorForm, scope: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl dark:bg-slate-900"
                  />
                </FormField>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setIsAddContractorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedContractorToAdd}>
                Save Contractor Link
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Compliance Override Dialog */}
      <ConfirmDialog
        isOpen={isComplianceWarningOpen}
        onClose={() => {
          setIsComplianceWarningOpen(false);
          setSelectedContractorToAdd(null);
        }}
        onConfirm={() => setIsComplianceWarningOpen(false)}
        title="Compliance Warning: Non-Compliant Contractor"
        message={complianceWarningMsg}
        confirmLabel="Acknowledge & Proceed"
        variant="danger"
      />

      {/* Quote Engage Prompt Dialog */}
      <ConfirmDialog
        isOpen={!!engagePrompt}
        onClose={() => setEngagePrompt(null)}
        onConfirm={handleConfirmEngage}
        title="Mark Contractor as Engaged?"
        message={
          engagePrompt
            ? `Quotation approved for ${engagePrompt.contractorName} ($${engagePrompt.amount.toLocaleString()}). Would you like to automatically assign them as an ENGAGED contractor on this seva?`
            : ""
        }
        confirmLabel="Engage Contractor"
        variant="primary"
      />

      {/* Edit Modal */}
      <SevaFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={loadSeva}
        initialData={seva}
      />

      {/* Archive Confirm */}
      <ConfirmDialog
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={handleArchive}
        title="Archive Seva"
        message="Are you sure you want to archive this Seva? If it is a group container, all sub-tasks in its subtree will also be archived."
      />

      {/* Convert to Group Confirm */}
      <ConfirmDialog
        isOpen={isConvertGroupOpen}
        onClose={() => setIsConvertGroupOpen(false)}
        onConfirm={handleConvertGroup}
        title="Convert to Project Group"
        message="Converting this seva to a Group container will cancel any pending occurrences and allow you to organize smaller sub-seva under it. This action cannot be reversed."
      />

      {/* Manage Required Licences Modal */}
      {isEditReqModalOpen && (
        <Modal
          isOpen={isEditReqModalOpen}
          onClose={() => setIsEditReqModalOpen(false)}
          title="Required Licences & Tickets"
          description="Specify tickets or certifications required by volunteers performing this seva task"
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Existing requirements */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Active Requirements ({requiredLicences.length})
              </h4>
              {requiredLicences.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-2">No licences currently required.</p>
              ) : (
                <div className="space-y-1.5">
                  {requiredLicences.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {req.licenceType?.name}
                        </span>
                        {req.classRequired && (
                          <span className="ml-1 text-slate-500">({req.classRequired})</span>
                        )}
                        <span className="ml-2 text-slate-400">• Min {req.minHolders} holder{req.minHolders > 1 ? "s" : ""}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveRequirement(req.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1"
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new requirement form */}
            <form onSubmit={handleAddRequirement} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Add Required Licence</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Licence Type
                  </label>
                  <select
                    value={newReqTypeId}
                    onChange={(e) => setNewReqTypeId(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  >
                    {allLicenceTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Min Holders
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newReqMinHolders}
                    onChange={(e) => setNewReqMinHolders(Number(e.target.value))}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Specific Class (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LF, under 11m, C6"
                    value={newReqClass}
                    onChange={(e) => setNewReqClass(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <Button size="sm" variant="primary" type="submit" icon={<Plus className="w-3.5 h-3.5" />}>
                  Add Requirement
                </Button>
              </div>
            </form>

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setIsEditReqModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
