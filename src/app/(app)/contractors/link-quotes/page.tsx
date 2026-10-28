"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Link as LinkIcon,
  ChevronRight,
  FileText,
  Building,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { useCurrentUser } from "@/core/auth/useCurrentUser";

export default function LinkQuotesPage() {
  const { hasPermission } = useCurrentUser();
  const canManage = hasPermission("contractors.manage") || hasPermission("contractors.write");

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/contractors/link-quotes/suggestions");
      if (res.ok) {
        const j = await res.json();
        setSuggestions(j.data || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadSuggestions();
    }
  }, [canManage]);

  const handleLinkQuote = async (sevaFileId: string, contractorId: string) => {
    setLinkingId(sevaFileId);
    try {
      const res = await fetch("/api/v1/files/link-contractor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sevaFileId, contractorId }),
      });
      if (res.ok) {
        // Remove from list
        setSuggestions((prev) => prev.filter((s) => s.file.id !== sevaFileId));
      }
    } catch {} finally {
      setLinkingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Coordinators and Administrators can link quotations to contractors.
        </p>
        <Link href="/contractors">
          <Button variant="secondary">Back to Directory</Button>
        </Link>
      </div>
    );
  }

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
        <span className="font-semibold text-slate-900 dark:text-slate-100">Link Existing Quotes</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <LinkIcon className="w-6 h-6 text-indigo-600" /> Link Historical Quotes to Contractors
          </h1>
          <p className="text-xs text-slate-500">
            Intelligent name-matching suggestions for past task quotations. Review and confirm matches individually (never linked automatically).
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadSuggestions}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Suggestions
        </Button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">Scanning quotes for suggestions...</div>
      ) : suggestions.length === 0 ? (
        <EmptyState
          title="All quotations are linked"
          description="Every quotation file in the system is already linked to a registered contractor or has no matches."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Found <strong>{suggestions.length}</strong> quotations with matching registered contractors:
          </p>

          <div className="space-y-3">
            {suggestions.map((item) => (
              <div
                key={item.file.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {item.file.caption || item.file.fileObject?.originalName}
                    </span>
                    <Badge size="sm" variant="neutral">
                      Supplier: &ldquo;{item.file.supplierName}&rdquo;
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Task: </span>
                    <Link
                      href={`/seva/${item.file.sevaId}`}
                      target="_blank"
                      className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
                    >
                      {item.file.seva?.code} - {item.file.seva?.title} <ExternalLink className="w-3 h-3" />
                    </Link>
                    {item.file.amount != null && (
                      <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                        (${Number(item.file.amount).toFixed(2)})
                      </span>
                    )}
                  </div>

                  <div className="pt-1 flex items-center gap-2 text-xs">
                    <span className="text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Suggested Match:
                    </span>
                    <Link
                      href={`/contractors/${item.matchedContractor.id}`}
                      target="_blank"
                      className="font-bold text-slate-800 dark:text-slate-200 hover:underline"
                    >
                      {item.matchedContractor.companyName} [{item.matchedContractor.code}]
                    </Link>
                    <span className="text-slate-400 text-[11px]">
                      ({(item.similarity * 100).toFixed(0)}% similarity)
                    </span>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={linkingId === item.file.id}
                    onClick={() => handleLinkQuote(item.file.id, item.matchedContractor.id)}
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Confirm Link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
