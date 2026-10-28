"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Inbox,
  ChevronRight,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Edit2,
  User,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { useCurrentUser } from "@/core/auth/useCurrentUser";
import { format } from "date-fns";

export default function ContractorRequestsQueuePage() {
  const { hasPermission } = useCurrentUser();
  const canReview = hasPermission("contractors.requests.review");

  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [typeFilter, setTypeFilter] = useState("");

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/v1/contractor-requests?${params.toString()}`);
      if (res.ok) {
        const j = await res.json();
        setRequests(j.data || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canReview) {
      loadRequests();
    }
  }, [canReview, statusFilter, typeFilter]);

  if (!canReview) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Coordinators and Administrators have permission to review contractor requests.
        </p>
        <Link href="/contractors/requests/mine">
          <Button variant="primary">View My Own Requests</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
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
        <span className="font-semibold text-slate-900 dark:text-slate-100">Review Queue</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Inbox className="w-6 h-6 text-indigo-600" /> Contractor Proposal Queue
          </h1>
          <p className="text-xs text-slate-500">
            Review community suggestions, inspect proposed changes side-by-side, and approve or reject.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {["OPEN", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "WITHDRAWN", "ALL"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors ${
                statusFilter === st
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {st === "OPEN" ? "Pending Review" : st.replace("_", " ")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-2.5 py-1.5 border rounded-xl dark:bg-slate-950 text-xs"
          >
            <option value="">All Request Types</option>
            <option value="NEW_CONTRACTOR">New Contractor</option>
            <option value="UPDATE_CONTRACTOR">Update Existing</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading queue...</div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests found"
          description="There are currently no proposals matching the selected filter criteria."
        />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4">Request Code</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Proposed Contractor</th>
                  <th className="py-3 px-4">Submitted By</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {req.code}
                    </td>
                    <td className="py-3 px-4">
                      <Badge size="sm" variant={req.type === "NEW_CONTRACTOR" ? "info" : "neutral"}>
                        {req.type === "NEW_CONTRACTOR" ? "New Contractor" : "Update"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {req.proposedData?.companyName || req.contractor?.companyName || "Untitled"}
                      </span>
                      {req.note && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">&ldquo;{req.note}&rdquo;</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {req.requestedBy?.name || "Member"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        size="sm"
                        variant={
                          req.status === "OPEN"
                            ? "warning"
                            : req.status === "APPROVED"
                            ? "success"
                            : req.status === "PARTIALLY_APPROVED"
                            ? "info"
                            : "danger"
                        }
                      >
                        {req.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {format(new Date(req.createdAt), "dd MMM yyyy")}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/contractors/requests/${req.id}`}>
                        <Button size="sm" variant={req.status === "OPEN" ? "primary" : "secondary"}>
                          {req.status === "OPEN" ? "Review" : "View"}
                        </Button>
                      </Link>
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
