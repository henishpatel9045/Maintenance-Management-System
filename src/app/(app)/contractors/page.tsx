"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  Phone,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Star,
  Download,
  Upload,
  FileText,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Clock,
  Sparkles,
  Link as LinkIcon,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { Skeleton } from "@/core/ui-kit/Skeleton";
import { useCurrentUser } from "@/core/auth/useCurrentUser";

export default function ContractorsDirectoryPage() {
  const { user, hasPermission } = useCurrentUser();

  const [contractors, setContractors] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [afterHoursOnly, setAfterHoursOnly] = useState(false);
  const [validInsuranceOnly, setValidInsuranceOnly] = useState(false);
  const [ratingMin, setRatingMin] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (selectedTrade) params.set("tradeId", selectedTrade);
      if (statusFilter) params.set("status", statusFilter);
      if (preferredOnly) params.set("isPreferred", "true");
      if (afterHoursOnly) params.set("afterHours", "true");
      if (validInsuranceOnly) params.set("hasValidInsurance", "true");
      if (ratingMin) params.set("ratingMin", ratingMin);
      params.set("limit", "100");

      const [contractorsRes, tradesRes] = await Promise.all([
        fetch(`/api/v1/contractors?${params.toString()}`),
        fetch("/api/v1/trades"),
      ]);

      if (contractorsRes.ok) {
        const json = await contractorsRes.json();
        setContractors(json.data || []);
      }
      if (tradesRes.ok) {
        const json = await tradesRes.json();
        setTrades(json.data || []);
      }
    } catch (err) {
      console.error("Failed to load contractors", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedTrade, statusFilter, preferredOnly, afterHoursOnly, validInsuranceOnly, ratingMin]);

  const canWrite = hasPermission("contractors.write");
  const canReview = hasPermission("contractors.requests.review");
  const canImport = hasPermission("contractors.import");
  const canManage = hasPermission("contractors.manage");

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Contractor Directory
            </h1>
            <Badge variant="neutral" size="sm">
              {contractors.length} {contractors.length === 1 ? "company" : "companies"}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Central directory of vetted contractors, credentials, and trades.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export Dropdown */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
            <a
              href="/api/v1/contractors/export?format=csv"
              download
              className="text-xs px-2.5 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Export as CSV"
            >
              CSV
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a
              href="/api/v1/contractors/export?format=xlsx"
              download
              className="text-xs px-2.5 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Export as Excel"
            >
              Excel
            </a>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <a
              href="/api/v1/contractors/export?format=pdf"
              download
              className="text-xs px-2.5 py-1.5 font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              title="Export as PDF"
            >
              PDF
            </a>
          </div>

          <Link href="/contractors/requests/mine">
            <Button variant="secondary" size="sm">
              <Clock className="w-4 h-4 mr-1.5" />
              My Requests
            </Button>
          </Link>

          {canReview && (
            <Link href="/contractors/requests">
              <Button variant="secondary" size="sm">
                <HelpCircle className="w-4 h-4 mr-1.5 text-amber-500" />
                Review Queue
              </Button>
            </Link>
          )}

          {canImport && (
            <Link href="/contractors/import">
              <Button variant="secondary" size="sm">
                <Upload className="w-4 h-4 mr-1.5" />
                Import
              </Button>
            </Link>
          )}

          {canManage && (
            <Link href="/contractors/link-quotes">
              <Button variant="secondary" size="sm">
                <LinkIcon className="w-4 h-4 mr-1.5" />
                Link Quotes
              </Button>
            </Link>
          )}

          <Link href="/contractors/suggest">
            <Button variant="secondary" size="sm">
              <Sparkles className="w-4 h-4 mr-1.5 text-indigo-500" />
              Suggest Contractor
            </Button>
          </Link>

          {canWrite && (
            <Link href="/contractors/new">
              <Button variant="primary" size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Contractor
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search & Filters Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by company, trading name, contact, phone, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Trade Filter */}
          <select
            value={selectedTrade}
            onChange={(e) => setSelectedTrade(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Trades</option>
            {trades.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
          </select>

          {/* Rating Min */}
          <select
            value={ratingMin}
            onChange={(e) => setRatingMin(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Any Rating</option>
            <option value="4.5">4.5+ Stars</option>
            <option value="4.0">4.0+ Stars</option>
            <option value="3.0">3.0+ Stars</option>
          </select>
        </div>

        {/* Toggle Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreferredOnly(!preferredOnly)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                preferredOnly
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              ★ Preferred Only
            </button>
            <button
              onClick={() => setValidInsuranceOnly(!validInsuranceOnly)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                validInsuranceOnly
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              ✓ Valid Insurance Only
            </button>
            <button
              onClick={() => setAfterHoursOnly(!afterHoursOnly)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                afterHoursOnly
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-semibold"
                  : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300"
              }`}
            >
              24/7 After Hours
            </button>
          </div>

          {/* Desktop View Switcher */}
          <div className="hidden sm:flex items-center gap-1 border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-50 dark:bg-slate-950">
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2 py-1 text-xs font-medium rounded ${
                viewMode === "cards"
                  ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2 py-1 text-xs font-medium rounded ${
                viewMode === "table"
                  ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && contractors.length === 0 && (
        <EmptyState
          icon={<Briefcase className="w-10 h-10 text-slate-400" />}
          title="No contractors found"
          description={
            search || selectedTrade || statusFilter || preferredOnly || afterHoursOnly || validInsuranceOnly
              ? "No companies match the current filter criteria. Try resetting filters."
              : "No contractors have been registered in the system yet."
          }
          actionLabel="Suggest a Contractor"
          onAction={() => {
            window.location.href = "/contractors/suggest";
          }}
        />
      )}

      {/* Cards View (Mobile-First) */}
      {!isLoading && contractors.length > 0 && viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contractors.map((c) => {
            const isBlocked = c.status === "BLOCKED";
            const primaryContact = c.contacts?.[0];
            const hasInsurance = c.credentials?.some(
              (cred: any) => cred.kind === "INSURANCE" && cred.status === "VALID"
            );
            const hasExpiringCreds = c.credentials?.some(
              (cred: any) => cred.status === "EXPIRING_SOON"
            );

            const phone = primaryContact?.phone || primaryContact?.mobile || c.mainPhone;
            const email = primaryContact?.email || c.mainEmail;

            return (
              <div
                key={c.id}
                className={`flex flex-col justify-between bg-white dark:bg-slate-900 border rounded-xl overflow-hidden transition-all hover:shadow-md ${
                  isBlocked
                    ? "border-red-300 dark:border-red-900/60 ring-1 ring-red-500/20"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                {/* Blocked Red Banner */}
                {isBlocked && (
                  <div className="bg-red-600 text-white px-4 py-1.5 text-xs font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      BLOCKED CONTRACTOR
                    </span>
                    <span className="text-[11px] opacity-90">Do Not Engage</span>
                  </div>
                )}

                <div className="p-5 space-y-3">
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/contractors/${c.id}`}
                          className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 text-base"
                        >
                          {c.companyName}
                        </Link>
                        {c.isPreferred && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            ★ PREFERRED
                          </span>
                        )}
                      </div>
                      {c.tradingName && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          t/a {c.tradingName}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {c.code}
                    </span>
                  </div>

                  {/* Trades Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {c.trades?.map((t: any) => (
                      <span
                        key={t.trade?.id || t.tradeId}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          t.isPrimary
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-medium border border-indigo-200 dark:border-indigo-800"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {t.trade?.name || "Trade"}
                      </span>
                    ))}
                  </div>

                  {/* Rating & Credential Health Badges */}
                  <div className="flex items-center gap-2 pt-1">
                    {c.avgRating !== null && c.avgRating !== undefined ? (
                      <div className="flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 mr-1" />
                        {c.avgRating}
                        <span className="text-[11px] font-normal text-slate-400 ml-1">
                          ({c.reviewCount || 0})
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">No reviews yet</span>
                    )}

                    <span className="text-slate-300 dark:text-slate-700">•</span>

                    {/* Credential Status Badge */}
                    {hasInsurance ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Insured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        No Valid Insurance
                      </span>
                    )}

                    {hasExpiringCreds && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200">
                        Expiring Soon
                      </span>
                    )}
                  </div>

                  {/* Primary Contact Details */}
                  {primaryContact && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {primaryContact.name}
                      </span>
                      {primaryContact.jobTitle && (
                        <span className="text-slate-400"> • {primaryContact.jobTitle}</span>
                      )}
                    </div>
                  )}

                  {/* Suburb & State */}
                  {(c.suburb || c.state) && (
                    <p className="text-xs text-slate-500">
                      📍 {[c.suburb, c.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>

                {/* Card Action Footer with tap-to-call & tap-to-email */}
                <div className="bg-slate-50 dark:bg-slate-950/60 px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {phone && (
                      <a
                        href={`tel:${phone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 text-xs font-medium transition-colors"
                        title={`Call ${phone}`}
                      >
                        <Phone className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Call
                      </a>
                    )}
                    {email && (
                      <a
                        href={`mailto:${email}`}
                        className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 text-xs font-medium transition-colors"
                        title={`Email ${email}`}
                      >
                        <Mail className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                        Email
                      </a>
                    )}
                  </div>

                  <Link
                    href={`/contractors/${c.id}`}
                    className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View Details
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Desktop Table View */}
      {!isLoading && contractors.length > 0 && viewMode === "table" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-950 text-xs uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Trades</th>
                  <th className="px-4 py-3">Primary Contact</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contractors.map((c) => {
                  const primaryContact = c.contacts?.[0];
                  const phone = primaryContact?.phone || primaryContact?.mobile || c.mainPhone;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-400">
                        {c.code}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <Link
                          href={`/contractors/${c.id}`}
                          className="hover:text-indigo-600 dark:hover:text-indigo-400"
                        >
                          {c.companyName}
                        </Link>
                        {c.isPreferred && (
                          <span className="ml-2 text-[10px] font-bold text-amber-500">
                            ★ PREFERRED
                          </span>
                        )}
                        {c.status === "BLOCKED" && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                            BLOCKED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.trades?.map((t: any) => (
                            <span
                              key={t.trade?.id || t.tradeId}
                              className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs"
                            >
                              {t.trade?.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {primaryContact?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {phone ? (
                          <a
                            href={`tel:${phone.replace(/\s+/g, "")}`}
                            className="text-indigo-600 hover:underline"
                          >
                            {phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            c.status === "ACTIVE"
                              ? "success"
                              : c.status === "BLOCKED"
                              ? "danger"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {c.avgRating ? `★ ${c.avgRating}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/contractors/${c.id}`}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
