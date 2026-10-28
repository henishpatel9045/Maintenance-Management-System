"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Ban,
  AlertCircle,
  FileText,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { format } from "date-fns";

export default function MyContractorRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/contractor-requests/mine");
      if (res.ok) {
        const j = await res.json();
        setRequests(j.data || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleWithdraw = async (requestId: string) => {
    if (!confirm("Are you sure you want to withdraw this request?")) return;
    try {
      const res = await fetch(`/api/v1/contractor-requests/${requestId}/withdraw`, {
        method: "POST",
      });
      if (res.ok) {
        loadRequests();
      }
    } catch {}
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge size="sm" variant="info">In Review</Badge>;
      case "APPROVED":
        return <Badge size="sm" variant="success">Approved</Badge>;
      case "PARTIALLY_APPROVED":
        return <Badge size="sm" variant="warning">Partly Approved</Badge>;
      case "REJECTED":
        return <Badge size="sm" variant="danger">Declined</Badge>;
      case "WITHDRAWN":
        return <Badge size="sm" variant="neutral">Withdrawn</Badge>;
      default:
        return <Badge size="sm" variant="neutral">{status}</Badge>;
    }
  };

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
        <span className="font-semibold text-slate-900 dark:text-slate-100">My Requests</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            My Contractor Requests
          </h1>
          <p className="text-xs text-slate-500">
            Track status and feedback for your contractor suggestions and change requests.
          </p>
        </div>
        <Link href="/contractors/suggest">
          <Button size="sm" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Suggest New Contractor
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Loading your requests...</div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No requests submitted yet"
          description="Have you worked with a good contractor? Suggest them to the organization so others can use their services."
          actionLabel="Suggest a Contractor"
          onAction={() => {
            window.location.href = "/contractors/suggest";
          }}
        />
      ) : (
        <div className="space-y-4">
          {/* Card View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {req.code}
                    </span>
                    <Badge size="sm" variant="neutral">
                      {req.type === "NEW_CONTRACTOR" ? "New Contractor" : "Update Request"}
                    </Badge>
                  </div>
                  {getStatusBadge(req.status)}
                </div>

                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {req.proposedData?.companyName || req.contractor?.companyName || "Contractor Proposal"}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 italic">
                    &ldquo;{req.note}&rdquo;
                  </p>
                </div>

                {/* Reviewer Note / Decision */}
                {req.reviewNote && (
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Coordinator Response:
                    </span>
                    <p className="text-slate-600 dark:text-slate-400">{req.reviewNote}</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>{format(new Date(req.createdAt), "dd MMM yyyy")}</span>

                  <div className="flex items-center gap-2">
                    {req.resultingContractorId && (
                      <Link href={`/contractors/${req.resultingContractorId}`}>
                        <Button variant="ghost" size="sm" className="text-xs text-indigo-600 gap-1">
                          View Directory <ExternalLink className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}

                    {req.status === "OPEN" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-500"
                        onClick={() => handleWithdraw(req.id)}
                      >
                        Withdraw
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
