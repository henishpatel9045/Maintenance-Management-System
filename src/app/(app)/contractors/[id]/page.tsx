"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  Phone,
  Mail,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Star,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  Download,
  Plus,
  Trash2,
  Edit2,
  Archive,
  Ban,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Activity,
  Send,
  Upload,
  UserCheck,
  FileCheck,
  Building,
  RefreshCw,
  Info,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Tabs } from "@/core/ui-kit/Tabs";
import { ConfirmDialog } from "@/core/ui-kit/ConfirmDialog";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField } from "@/core/ui-kit/FormField";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { useCurrentUser } from "@/core/auth/useCurrentUser";
import { format } from "date-fns";

export default function ContractorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contractorId = resolvedParams.id;
  const router = useRouter();
  const { user, hasPermission } = useCurrentUser();

  const [contractor, setContractor] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sub-resources
  const [contacts, setContacts] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [spend, setSpend] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");

  // Modals
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    jobTitle: "",
    phone: "",
    mobile: "",
    email: "",
    isPrimary: false,
    notes: "",
  });

  const [isCredentialModalOpen, setIsCredentialModalOpen] = useState(false);
  const [credentialForm, setCredentialForm] = useState({
    kind: "INSURANCE",
    type: "",
    issuer: "",
    number: "",
    coverAmount: "",
    issuedAt: "",
    expiresAt: "",
    notes: "",
  });

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadKind, setUploadKind] = useState("INSURANCE");
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadExpiresAt, setUploadExpiresAt] = useState("");

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    qualityRating: 5,
    timelinessRating: 5,
    priceRating: 5,
    wouldUseAgain: true,
    comment: "",
  });

  const canWrite = hasPermission("contractors.write");
  const canManage = hasPermission("contractors.manage");
  const canReadFull = hasPermission("contractors.readFull");
  const canCredentialsView = hasPermission("contractors.credentials.view");
  const canCredentialsManage = hasPermission("contractors.credentials.manage");
  const canDocumentsView = hasPermission("contractors.documents.view");
  const canDocumentsManage = hasPermission("contractors.documents.manage");
  const canReviewsWrite = hasPermission("contractors.reviews.write");
  const canAssign = hasPermission("contractors.assign");
  const canRequest = hasPermission("contractors.request");

  const loadContractor = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Contractor not found or module disabled.");
        } else {
          setError("Failed to load contractor details.");
        }
        return;
      }
      const json = await res.json();
      setContractor(json.data);
    } catch {
      setError("Network error loading contractor.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/contacts`);
      if (res.ok) {
        const j = await res.json();
        setContacts(j.data || []);
      }
    } catch {}
  };

  const loadCredentials = async () => {
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/credentials`);
      if (res.ok) {
        const j = await res.json();
        setCredentials(j.data || []);
      }
    } catch {}
  };

  const loadFiles = async () => {
    if (!canDocumentsView) return;
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/files`);
      if (res.ok) {
        const j = await res.json();
        setFiles(j.data || []);
      }
    } catch {}
  };

  const loadReviews = async () => {
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/reviews`);
      if (res.ok) {
        const j = await res.json();
        setReviews(j.data || []);
      }
    } catch {}
  };

  const loadJobsAndSpend = async () => {
    if (!canReadFull && !canAssign) return;
    try {
      const [jobsRes, spendRes] = await Promise.all([
        fetch(`/api/v1/contractors/${contractorId}/jobs`),
        fetch(`/api/v1/contractors/${contractorId}/spend`),
      ]);
      if (jobsRes.ok) {
        const j = await jobsRes.json();
        setJobs(j.data || []);
      }
      if (spendRes.ok) {
        const s = await spendRes.json();
        setSpend(s.data);
      }
    } catch {}
  };

  const loadComments = async () => {
    if (!canWrite && !canReadFull) return;
    try {
      const res = await fetch(`/api/v1/comments?entityType=CONTRACTOR&entityId=${contractorId}`);
      if (res.ok) {
        const j = await res.json();
        setComments(j.data || []);
      }
    } catch {}
  };

  useEffect(() => {
    loadContractor();
    loadContacts();
    loadCredentials();
    loadReviews();
  }, [contractorId]);

  useEffect(() => {
    if (contractor) {
      if (canDocumentsView) loadFiles();
      if (canReadFull || canAssign) loadJobsAndSpend();
      if (canWrite || canReadFull) loadComments();
    }
  }, [contractor, canDocumentsView, canReadFull, canAssign, canWrite]);

  const handleArchive = async () => {
    try {
      const endpoint = contractor.archivedAt ? "unarchive" : "archive";
      const res = await fetch(`/api/v1/contractors/${contractorId}/${endpoint}`, { method: "POST" });
      if (res.ok) {
        setIsArchiveModalOpen(false);
        loadContractor();
      }
    } catch {}
  };

  const handleBlock = async () => {
    try {
      const isBlocked = contractor.status === "BLOCKED";
      const endpoint = isBlocked ? "unblock" : "block";
      const body = isBlocked ? {} : { reason: blockReason };
      const res = await fetch(`/api/v1/contractors/${contractorId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setIsBlockModalOpen(false);
        setBlockReason("");
        loadContractor();
      }
    } catch {}
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingContact
        ? `/api/v1/contacts/${editingContact.id}`
        : `/api/v1/contractors/${contractorId}/contacts`;
      const method = editingContact ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contactForm),
      });
      if (res.ok) {
        setIsContactModalOpen(false);
        setEditingContact(null);
        setContactForm({
          name: "",
          jobTitle: "",
          phone: "",
          mobile: "",
          email: "",
          isPrimary: false,
          notes: "",
        });
        loadContacts();
      }
    } catch {}
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    try {
      const res = await fetch(`/api/v1/contacts/${contactId}`, { method: "DELETE" });
      if (res.ok) loadContacts();
    } catch {}
  };

  const handleMakePrimaryContact = async (contactId: string) => {
    try {
      const res = await fetch(`/api/v1/contacts/${contactId}/make-primary`, { method: "POST" });
      if (res.ok) loadContacts();
    } catch {}
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/credentials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...credentialForm,
          coverAmount: credentialForm.coverAmount ? Number(credentialForm.coverAmount) : undefined,
          issuedAt: credentialForm.issuedAt ? new Date(credentialForm.issuedAt).toISOString() : undefined,
          expiresAt: credentialForm.expiresAt ? new Date(credentialForm.expiresAt).toISOString() : undefined,
        }),
      });
      if (res.ok) {
        setIsCredentialModalOpen(false);
        setCredentialForm({
          kind: "INSURANCE",
          type: "",
          issuer: "",
          number: "",
          coverAmount: "",
          issuedAt: "",
          expiresAt: "",
          notes: "",
        });
        loadCredentials();
        loadContractor();
      }
    } catch {}
  };

  const handleVerifyCredential = async (credId: string) => {
    try {
      const res = await fetch(`/api/v1/credentials/${credId}/verify`, { method: "POST" });
      if (res.ok) {
        loadCredentials();
        loadContractor();
      }
    } catch {}
  };

  const handleDeleteCredential = async (credId: string) => {
    if (!confirm("Are you sure you want to remove this credential?")) return;
    try {
      const res = await fetch(`/api/v1/credentials/${credId}`, { method: "DELETE" });
      if (res.ok) {
        loadCredentials();
        loadContractor();
      }
    } catch {}
  };

  const handleUploadFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("kind", uploadKind);
      if (uploadLabel) formData.append("label", uploadLabel);
      if (uploadExpiresAt) formData.append("expiresAt", new Date(uploadExpiresAt).toISOString());

      const res = await fetch(`/api/v1/contractors/${contractorId}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        setIsUploadModalOpen(false);
        setUploadFile(null);
        setUploadLabel("");
        setUploadExpiresAt("");
        loadFiles();
      }
    } catch {}
  };

  const handleDeleteFile = async (fileLinkId: string) => {
    if (!confirm("Are you sure you want to unlink this file?")) return;
    try {
      const res = await fetch(`/api/v1/contractor-files/${fileLinkId}`, { method: "DELETE" });
      if (res.ok) loadFiles();
    } catch {}
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/v1/contractors/${contractorId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      if (res.ok) {
        setIsReviewModalOpen(false);
        setReviewForm({
          rating: 5,
          qualityRating: 5,
          timelinessRating: 5,
          priceRating: 5,
          wouldUseAgain: true,
          comment: "",
        });
        loadReviews();
        loadContractor();
      }
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
          entityType: "CONTRACTOR",
          entityId: contractorId,
          body: newComment.trim(),
        }),
      });
      if (res.ok) {
        setNewComment("");
        loadComments();
      }
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 animate-pulse">
        Loading contractor profile...
      </div>
    );
  }

  if (error || !contractor) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Unable to load contractor</h2>
        <p className="text-sm text-slate-500">{error || "Contractor not found"}</p>
        <Link href="/contractors">
          <Button variant="secondary">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  const isBlocked = contractor.status === "BLOCKED";
  const isArchived = !!contractor.archivedAt;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "credentials", label: "Credentials", count: credentials.length },
    ...(canDocumentsView ? [{ id: "documents", label: "Documents", count: files.length }] : []),
    ...(canReadFull || canAssign ? [{ id: "jobs", label: "Jobs & Spend", count: jobs.length }] : []),
    { id: "reviews", label: "Reviews", count: contractor.reviewCount || reviews.length },
    ...(canWrite || canReadFull ? [{ id: "activity", label: "Notes & Activity", count: comments.length }] : []),
  ];

  return (
    <div className="space-y-4 pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto pb-1">
        <Link href="/" className="hover:underline">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <Link href="/contractors" className="hover:underline">
          Contractors
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{contractor.companyName}</span>
      </div>

      {/* Blocked Banner */}
      {isBlocked && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/50 rounded-2xl flex items-start gap-3">
          <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <h3 className="font-bold text-rose-900 dark:text-rose-100">Contractor is BLOCKED</h3>
            <p className="text-rose-700 dark:text-rose-300 mt-0.5">
              {contractor.blockedReason
                ? `Reason: ${contractor.blockedReason}`
                : "This contractor has been placed on hold and should not be engaged on new seva without approval."}
            </p>
          </div>
        </div>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
          <Archive className="w-4 h-4 shrink-0" />
          This contractor is archived and hidden from general directory searches.
        </div>
      )}

      {/* Main Header Profile Card */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/40">
                {contractor.code}
              </span>
              <Badge
                size="sm"
                variant={
                  contractor.status === "ACTIVE"
                    ? "success"
                    : contractor.status === "BLOCKED"
                    ? "danger"
                    : "neutral"
                }
              >
                {contractor.status}
              </Badge>
              {contractor.isPreferred && (
                <Badge size="sm" variant="info">
                  Preferred Partner
                </Badge>
              )}
              {contractor.afterHoursAvailable && (
                <Badge size="sm" variant="neutral">
                  <Clock className="w-3 h-3 mr-1" /> After-Hours
                </Badge>
              )}
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {contractor.companyName}
              </h1>
              {contractor.tradingName && contractor.tradingName !== contractor.companyName && (
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Trading as: <span className="font-medium text-slate-700 dark:text-slate-300">{contractor.tradingName}</span>
                </p>
              )}
            </div>

            {/* Quick Ratings & Credential Summary */}
            <div className="flex flex-wrap items-center gap-4 text-xs pt-1 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-bold">{contractor.averageRating ? contractor.averageRating.toFixed(1) : "—"}</span>
                <span className="text-slate-400">({contractor.reviewCount || 0} reviews)</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1.5">
                {contractor.hasValidInsurance ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="w-4 h-4" /> Insurance Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-500 font-medium">
                    <ShieldAlert className="w-4 h-4" /> No Active Insurance
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap sm:flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {contractor.mainPhone && (
                <a href={`tel:${contractor.mainPhone}`}>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" /> Call
                  </Button>
                </a>
              )}
              {contractor.mainEmail && (
                <a href={`mailto:${contractor.mainEmail}`}>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-indigo-600" /> Email
                  </Button>
                </a>
              )}
              <a
                href={`/api/v1/contractors/${contractorId}/profile-sheet`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="ghost" size="sm" title="Print Profile Sheet PDF">
                  <Download className="w-4 h-4" />
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-2">
              {canRequest && (
                <Link href={`/contractors/${contractorId}/suggest-change`}>
                  <Button variant="outline" size="sm" className="gap-1 text-xs">
                    <Edit2 className="w-3.5 h-3.5" /> Suggest Change
                  </Button>
                </Link>
              )}

              {canWrite && (
                <Link href={`/contractors/${contractorId}/edit`}>
                  <Button variant="secondary" size="sm" className="gap-1 text-xs">
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                </Link>
              )}

              {canManage && (
                <Button
                  variant={isBlocked ? "secondary" : "ghost"}
                  size="sm"
                  className={isBlocked ? "text-emerald-600 text-xs" : "text-rose-600 text-xs"}
                  onClick={() => setIsBlockModalOpen(true)}
                >
                  <Ban className="w-3.5 h-3.5 mr-1" />
                  {isBlocked ? "Unblock" : "Block"}
                </Button>
              )}

              {canWrite && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 text-xs"
                  onClick={() => setIsArchiveModalOpen(true)}
                >
                  <Archive className="w-3.5 h-3.5 mr-1" />
                  {isArchived ? "Unarchive" : "Archive"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      {/* Tab Contents */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {/* Trades & Category Skills */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" /> Trades & Capabilities
              </h2>
              <div className="flex flex-wrap gap-2">
                {contractor.trades?.length ? (
                  contractor.trades.map((t: any) => (
                    <span
                      key={t.trade.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border ${
                        t.isPrimary
                          ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                          : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {t.trade.name}
                      {t.isPrimary && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 rounded">
                          Primary
                        </span>
                      )}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-slate-400">No trades assigned.</p>
                )}
              </div>
            </div>

            {/* Address & Operational Areas */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" /> Location & Service Area
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-1">Physical Address</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {[contractor.addressLine1, contractor.addressLine2, contractor.suburb, contractor.state, contractor.postcode, contractor.country]
                      .filter(Boolean)
                      .join(", ") || "No physical address provided"}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">Servicing Regions</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {contractor.serviceAreas?.length
                      ? contractor.serviceAreas.join(", ")
                      : "General local area"}
                  </p>
                </div>
              </div>
            </div>

            {/* Tags */}
            {contractor.tags?.length > 0 && (
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-500">Tags & Keywords</span>
                <div className="flex flex-wrap gap-1.5">
                  {contractor.tags.map((tg: any, i: number) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    >
                      #{tg.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Business Details & Restricted Financials */}
          <div className="space-y-4">
            {/* Registration & Legal */}
            <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Building className="w-4 h-4 text-indigo-600" /> Company Information
              </h2>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Registration Type</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {contractor.registrationType || "ABN"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">Registration #</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {contractor.registrationNumber || "Not recorded"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400">GST Registered</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {contractor.gstRegistered ? "Yes" : "No"}
                  </span>
                </div>
                {contractor.website && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-400">Website</span>
                    <a
                      href={contractor.website.startsWith("http") ? contractor.website : `https://${contractor.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                {contractor.emergencyPhone && (
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-rose-500 font-medium">Emergency Line</span>
                    <a href={`tel:${contractor.emergencyPhone}`} className="font-medium text-rose-600 hover:underline">
                      {contractor.emergencyPhone}
                    </a>
                  </div>
                )}
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Payment Terms</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {contractor.paymentTerms || "Standard 30 Days"}
                  </span>
                </div>
              </div>
            </div>

            {/* Restricted Tier: Financial Rates & Internal Notes */}
            {canReadFull && (
              <div className="p-4 sm:p-5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-indigo-600" /> Commercial Terms
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                    Restricted
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-950">
                    <span className="text-slate-400 block mb-0.5">Call-Out Fee</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {contractor.callOutFee != null
                        ? `$${Number(contractor.callOutFee).toFixed(2)}`
                        : "None"}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-950">
                    <span className="text-slate-400 block mb-0.5">Standard Rate</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {contractor.hourlyRate != null
                        ? `$${Number(contractor.hourlyRate).toFixed(2)}/hr`
                        : "Quotes only"}
                    </span>
                  </div>
                </div>

                {contractor.internalNotes && (
                  <div className="pt-2 text-xs">
                    <span className="text-slate-500 font-semibold block mb-1">Internal Coordinator Notes:</span>
                    <p className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-indigo-100 dark:border-indigo-950 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {contractor.internalNotes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CONTACTS */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Company Representatives</h2>
            {canWrite && (
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  setEditingContact(null);
                  setContactForm({
                    name: "",
                    jobTitle: "",
                    phone: "",
                    mobile: "",
                    email: "",
                    isPrimary: contacts.length === 0,
                    notes: "",
                  });
                  setIsContactModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Contact
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((c) => (
              <div
                key={c.id}
                className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl relative space-y-3 ${
                  c.isPrimary
                    ? "border-indigo-200 dark:border-indigo-800 shadow-sm"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {c.isPrimary && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-indigo-500" /> Primary
                  </span>
                )}

                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{c.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{c.jobTitle || "Representative"}</p>
                </div>

                <div className="space-y-1.5 text-xs">
                  {c.phone && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <a href={`tel:${c.phone}`} className="hover:underline">
                        {c.phone}
                      </a>
                    </div>
                  )}
                  {c.mobile && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-emerald-500" />
                      <a href={`tel:${c.mobile}`} className="hover:underline">
                        {c.mobile} (Mobile)
                      </a>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-indigo-400" />
                      <a href={`mailto:${c.email}`} className="hover:underline">
                        {c.email}
                      </a>
                    </div>
                  )}
                  {c.notes && <p className="text-slate-400 text-[11px] pt-1">{c.notes}</p>}
                </div>

                {canWrite && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    {!c.isPrimary && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-indigo-600"
                        onClick={() => handleMakePrimaryContact(c.id)}
                      >
                        Make Primary
                      </Button>
                    )}
                    <div className="flex items-center gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingContact(c);
                          setContactForm({
                            name: c.name,
                            jobTitle: c.jobTitle || "",
                            phone: c.phone || "",
                            mobile: c.mobile || "",
                            email: c.email || "",
                            isPrimary: c.isPrimary,
                            notes: c.notes || "",
                          });
                          setIsContactModalOpen(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteContact(c.id)}
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CREDENTIALS */}
      {activeTab === "credentials" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Licences & Insurance Verification</h2>
              <p className="text-xs text-slate-500">
                {canCredentialsView
                  ? "Full credential numbers and validity dates visible to compliance coordinators."
                  : "Status badges visible to all members."}
              </p>
            </div>
            {canCredentialsManage && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsCredentialModalOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Credential
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {credentials.map((cred) => {
              const isValid = cred.status === "VALID";
              const isExpiring = cred.status === "EXPIRING_SOON";
              const isExpired = cred.status === "EXPIRED";

              return (
                <div
                  key={cred.id}
                  className={`p-4 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isExpired
                      ? "border-rose-200 dark:border-rose-900/60"
                      : isExpiring
                      ? "border-amber-200 dark:border-amber-900/60"
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isValid
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600"
                          : isExpiring
                          ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600"
                          : "bg-rose-50 dark:bg-rose-950/50 text-rose-600"
                      }`}
                    >
                      {isValid ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {cred.type}
                        </h3>
                        <Badge
                          size="sm"
                          variant={isValid ? "success" : isExpiring ? "warning" : "danger"}
                        >
                          {cred.status.replace("_", " ")}
                        </Badge>
                        <span className="text-xs text-slate-400 capitalize">({cred.kind.toLowerCase()})</span>
                      </div>

                      {canCredentialsView ? (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                          {cred.number && (
                            <span>
                              Licence/Policy #: <strong className="font-mono text-slate-800 dark:text-slate-200">{cred.number}</strong>
                            </span>
                          )}
                          {cred.issuer && <span>Issuer: {cred.issuer}</span>}
                          {cred.coverAmount && (
                            <span>Cover: ${Number(cred.coverAmount).toLocaleString()}</span>
                          )}
                          {cred.expiresAt && (
                            <span>Expires: {format(new Date(cred.expiresAt), "dd MMM yyyy")}</span>
                          )}
                          {cred.verifiedAt && (
                            <span className="text-emerald-600 flex items-center gap-1 font-medium">
                              <UserCheck className="w-3.5 h-3.5" /> Verified
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Credential details verified by management. Status badge is publicly visible.
                        </p>
                      )}
                    </div>
                  </div>

                  {canCredentialsManage && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {!cred.verifiedAt && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => handleVerifyCredential(cred.id)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Verify
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCredential(cred.id)}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: DOCUMENTS */}
      {activeTab === "documents" && canDocumentsView && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Document Vault</h2>
              <p className="text-xs text-slate-500">
                Uploaded agreements, compliance policies, insurance certificates, and invoices.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a href={`/api/v1/contractors/${contractorId}/files.zip`} download>
                <Button variant="secondary" size="sm" className="gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download ZIP
                </Button>
              </a>
              {canDocumentsManage && (
                <Button size="sm" className="gap-1.5" onClick={() => setIsUploadModalOpen(true)}>
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => (
              <div
                key={f.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="overflow-hidden space-y-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate" title={f.label || f.fileObject?.originalName}>
                      {f.label || f.fileObject?.originalName || "Document"}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Badge size="sm" variant="neutral">{f.kind}</Badge>
                      <span>{(f.fileObject?.sizeBytes / 1024).toFixed(0)} KB</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <a
                    href={`/api/v1/contractor-files/${f.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                  {canDocumentsManage && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteFile(f.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: JOBS & SPEND */}
      {activeTab === "jobs" && (canReadFull || canAssign) && (
        <div className="space-y-4">
          {/* Spend Summary Card */}
          {spend && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Total Jobs Engaged</span>
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {spend.jobsCount || 0}
                </span>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Total Invoiced Spend</span>
                <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  ${Number(spend.totalInvoiced || 0).toFixed(2)}
                </span>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <span className="text-xs text-slate-400 block mb-1">Total Quoted Pipeline</span>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  ${Number(spend.totalQuoted || 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Jobs List */}
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Linked Seva Tasks</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <tr>
                    <th className="py-2">Seva Code & Title</th>
                    <th>Role</th>
                    <th>Status</th>
                    {canReadFull && <th>Quoted</th>}
                    {canReadFull && <th>Invoiced</th>}
                    <th>Engaged Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 font-medium">
                        <Link href={`/seva/${job.sevaId}`} className="text-indigo-600 hover:underline">
                          {job.seva?.code || "SEV"} - {job.seva?.title || "Task"}
                        </Link>
                      </td>
                      <td>
                        <Badge size="sm" variant="neutral">{job.role}</Badge>
                      </td>
                      <td>
                        <Badge size="sm" variant={job.status === "COMPLETED" ? "success" : "info"}>
                          {job.status}
                        </Badge>
                      </td>
                      {canReadFull && (
                        <td className="font-mono">
                          {job.quotedAmount != null ? `$${Number(job.quotedAmount).toFixed(2)}` : "—"}
                        </td>
                      )}
                      {canReadFull && (
                        <td className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {job.invoicedAmount != null ? `$${Number(job.invoicedAmount).toFixed(2)}` : "—"}
                        </td>
                      )}
                      <td className="text-slate-400">
                        {job.engagedAt ? format(new Date(job.engagedAt), "dd MMM yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REVIEWS */}
      {activeTab === "reviews" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Performance & Reviews</h2>
              <p className="text-xs text-slate-500">
                Coordinators record ratings and quality feedback from completed jobs.
              </p>
            </div>
            {canReviewsWrite && (
              <Button size="sm" className="gap-1.5" onClick={() => setIsReviewModalOpen(true)}>
                <Star className="w-3.5 h-3.5" /> Add Review
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= r.rating ? "text-amber-500 fill-amber-500" : "text-slate-300 dark:text-slate-700"
                        }`}
                      />
                    ))}
                    <span className="font-bold text-xs ml-1 text-slate-800 dark:text-slate-200">
                      {r.rating}/5
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy") : ""}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[11px] bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                  <div>
                    <span className="text-slate-400 block">Quality</span>
                    <strong className="text-slate-800 dark:text-slate-200">{r.qualityRating || r.rating}/5</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Timeliness</span>
                    <strong className="text-slate-800 dark:text-slate-200">{r.timelinessRating || r.rating}/5</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Pricing</span>
                    <strong className="text-slate-800 dark:text-slate-200">{r.priceRating || r.rating}/5</strong>
                  </div>
                </div>

                {canReadFull && r.comment && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic pt-1">
                    &ldquo;{r.comment}&rdquo;
                  </p>
                )}

                <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                  <span>Reviewed by {r.reviewedBy?.name || "Coordinator"}</span>
                  {r.wouldUseAgain && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Recommended
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: NOTES & ACTIVITY */}
      {activeTab === "activity" && (canWrite || canReadFull) && (
        <div className="space-y-4">
          <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-600" /> Internal Discussion & Coordinator Notes
            </h2>

            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Add an internal note or update about this contractor..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" size="sm" className="gap-1">
                <Send className="w-3.5 h-3.5" /> Post
              </Button>
            </form>

            <div className="space-y-3 pt-2">
              {comments.map((cm) => (
                <div key={cm.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {cm.author?.name || "Staff Member"}
                    </span>
                    <span>{format(new Date(cm.createdAt), "dd MMM yyyy, HH:mm")}</span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{cm.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}

      {/* Contact Modal */}
      {isContactModalOpen && (
        <Modal
          isOpen={isContactModalOpen}
          onClose={() => setIsContactModalOpen(false)}
          title={editingContact ? "Edit Contact" : "Add Representative"}
        >
          <form onSubmit={handleSaveContact} className="space-y-3 text-xs">
            <FormField label="Full Name" required>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <FormField label="Job Title / Role">
              <input
                type="text"
                value={contactForm.jobTitle}
                onChange={(e) => setContactForm({ ...contactForm, jobTitle: e.target.value })}
                placeholder="e.g. Lead Electrician / Director"
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Office Phone">
                <input
                  type="text"
                  value={contactForm.phone}
                  onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
              <FormField label="Mobile">
                <input
                  type="text"
                  value={contactForm.mobile}
                  onChange={(e) => setContactForm({ ...contactForm, mobile: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
            </div>
            <FormField label="Email">
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={contactForm.isPrimary}
                onChange={(e) => setContactForm({ ...contactForm, isPrimary: e.target.checked })}
              />
              Designate as Primary Contact for this contractor
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsContactModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Contact</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Credential Modal */}
      {isCredentialModalOpen && (
        <Modal
          isOpen={isCredentialModalOpen}
          onClose={() => setIsCredentialModalOpen(false)}
          title="Add Credential / Insurance"
        >
          <form onSubmit={handleSaveCredential} className="space-y-3 text-xs">
            <FormField label="Credential Kind" required>
              <select
                value={credentialForm.kind}
                onChange={(e) => setCredentialForm({ ...credentialForm, kind: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              >
                <option value="INSURANCE">Insurance</option>
                <option value="LICENCE">Licence</option>
                <option value="CERTIFICATION">Certification</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
            <FormField label="Credential Type / Label" required>
              <input
                type="text"
                required
                placeholder="e.g. Public Liability, Electrical Licence, White Card"
                value={credentialForm.type}
                onChange={(e) => setCredentialForm({ ...credentialForm, type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Issuer / Insurer">
                <input
                  type="text"
                  placeholder="e.g. Allianz, QBE, Fair Trading"
                  value={credentialForm.issuer}
                  onChange={(e) => setCredentialForm({ ...credentialForm, issuer: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
              <FormField label="Licence / Policy #">
                <input
                  type="text"
                  placeholder="Policy or licence number"
                  value={credentialForm.number}
                  onChange={(e) => setCredentialForm({ ...credentialForm, number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FormField label="Cover Amount ($)">
                <input
                  type="number"
                  placeholder="e.g. 20000000"
                  value={credentialForm.coverAmount}
                  onChange={(e) => setCredentialForm({ ...credentialForm, coverAmount: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
              <FormField label="Expiry Date">
                <input
                  type="date"
                  value={credentialForm.expiresAt}
                  onChange={(e) => setCredentialForm({ ...credentialForm, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCredentialModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Credential</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <Modal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          title="Upload Document"
        >
          <form onSubmit={handleUploadFile} className="space-y-3 text-xs">
            <FormField label="Document Folder / Category" required>
              <select
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              >
                <option value="INSURANCE">Insurance Policy</option>
                <option value="CREDENTIAL">Licence / Credential</option>
                <option value="CONTRACT">Contract / Agreement</option>
                <option value="INVOICE">Invoice</option>
                <option value="QUOTE">Quotation</option>
                <option value="OTHER">Other Document</option>
              </select>
            </FormField>
            <FormField label="Document Label / Title">
              <input
                type="text"
                placeholder="e.g. 2026 Certificate of Currency"
                value={uploadLabel}
                onChange={(e) => setUploadLabel(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <FormField label="Expiry Date (optional)">
              <input
                type="date"
                value={uploadExpiresAt}
                onChange={(e) => setUploadExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <FormField label="Select File" required>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-xs"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsUploadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Upload Document</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Review Modal */}
      {isReviewModalOpen && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title="Record Contractor Performance Review"
        >
          <form onSubmit={handleSaveReview} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Overall Rating (1 to 5)" required>
                <select
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                >
                  <option value={5}>5 Stars - Excellent</option>
                  <option value={4}>4 Stars - Good</option>
                  <option value={3}>3 Stars - Average</option>
                  <option value={2}>2 Stars - Below Expectations</option>
                  <option value={1}>1 Star - Unsatisfactory</option>
                </select>
              </FormField>
              <FormField label="Quality of Work">
                <select
                  value={reviewForm.qualityRating}
                  onChange={(e) => setReviewForm({ ...reviewForm, qualityRating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                >
                  <option value={5}>5 - Superb</option>
                  <option value={4}>4 - Good</option>
                  <option value={3}>3 - Acceptable</option>
                  <option value={2}>2 - Poor</option>
                  <option value={1}>1 - Redo needed</option>
                </select>
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Timeliness & Schedule">
                <select
                  value={reviewForm.timelinessRating}
                  onChange={(e) => setReviewForm({ ...reviewForm, timelinessRating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                >
                  <option value={5}>5 - On time / Early</option>
                  <option value={4}>4 - Minor delay</option>
                  <option value={3}>3 - Delayed</option>
                  <option value={2}>2 - Significant delay</option>
                  <option value={1}>1 - No show</option>
                </select>
              </FormField>
              <FormField label="Price Fairness">
                <select
                  value={reviewForm.priceRating}
                  onChange={(e) => setReviewForm({ ...reviewForm, priceRating: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
                >
                  <option value={5}>5 - Excellent value</option>
                  <option value={4}>4 - Reasonable</option>
                  <option value={3}>3 - Expected</option>
                  <option value={2}>2 - Expensive</option>
                  <option value={1}>1 - Overpriced</option>
                </select>
              </FormField>
            </div>
            <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={reviewForm.wouldUseAgain}
                onChange={(e) => setReviewForm({ ...reviewForm, wouldUseAgain: e.target.checked })}
              />
              Would engage again for future seva
            </label>
            <FormField label="Review Comments & Feedback">
              <textarea
                rows={3}
                placeholder="Specific feedback on quality, communication, punctuality and site cleanup..."
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsReviewModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Submit Review</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Block Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBlockModalOpen}
        onClose={() => setIsBlockModalOpen(false)}
        onConfirm={handleBlock}
        title={isBlocked ? "Unblock Contractor" : "Block Contractor"}
        message={
          isBlocked
            ? "Are you sure you want to restore this contractor to ACTIVE status?"
            : "Blocking will mark the contractor as BLOCKED and prevent new engagements without explicit override."
        }
        confirmLabel={isBlocked ? "Unblock" : "Block Contractor"}
        variant={isBlocked ? "primary" : "danger"}
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isArchiveModalOpen}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleArchive}
        title={isArchived ? "Unarchive Contractor" : "Archive Contractor"}
        message={
          isArchived
            ? "Restore this contractor to active directory searches?"
            : "Archived contractors are preserved in historical records and linked seva, but hidden from regular searches."
        }
        confirmLabel={isArchived ? "Restore" : "Archive"}
        variant="primary"
      />
    </div>
  );
}
