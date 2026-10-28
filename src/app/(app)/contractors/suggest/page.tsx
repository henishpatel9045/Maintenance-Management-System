"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronRight,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  Upload,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { FormField } from "@/core/ui-kit/FormField";

export default function SuggestNewContractorPage() {
  const router = useRouter();

  const [trades, setTrades] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [companyName, setCompanyName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [selectedTrades, setSelectedTrades] = useState<string[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [suburb, setSuburb] = useState("");
  const [website, setWebsite] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // Live duplicate warning state
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  useEffect(() => {
    fetch("/api/v1/trades")
      .then((r) => r.json())
      .then((j) => setTrades(j.data || []))
      .catch(() => {});
  }, []);

  // Debounced duplicate check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!companyName.trim() && !registrationNumber.trim()) {
        setDuplicateMatches([]);
        return;
      }
      setIsCheckingDuplicates(true);
      try {
        const params = new URLSearchParams();
        if (companyName.trim()) params.set("name", companyName.trim());
        if (registrationNumber.trim()) params.set("registrationNumber", registrationNumber.trim());
        const res = await fetch(`/api/v1/contractors/duplicates?${params.toString()}`);
        if (res.ok) {
          const j = await res.json();
          setDuplicateMatches(j.data || []);
        }
      } catch {} finally {
        setIsCheckingDuplicates(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [companyName, registrationNumber]);

  const handleToggleTrade = (tradeId: string) => {
    setSelectedTrades((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (files.length + newFiles.length > 3) {
      alert("You can attach a maximum of 3 supporting files (photos or documents).");
      return;
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, 3));
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setError("Company Name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const proposedData: any = {
        companyName: companyName.trim(),
        tradingName: tradingName.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        suburb: suburb.trim() || undefined,
        website: website.trim() || undefined,
        mainPhone: contactPhone.trim() || undefined,
        mainEmail: contactEmail.trim() || undefined,
        trades: selectedTrades,
        contacts: contactName.trim()
          ? [
              {
                name: contactName.trim(),
                phone: contactPhone.trim() || undefined,
                email: contactEmail.trim() || undefined,
                isPrimary: true,
              },
            ]
          : [],
      };

      const res = await fetch("/api/v1/contractor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NEW_CONTRACTOR",
          note: note.trim() || "Suggested by community member.",
          proposedData,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        setError(errJson.error?.message || "Failed to submit request.");
        setIsSubmitting(false);
        return;
      }

      const resJson = await res.json();
      const requestId = resJson.data.id;

      // Upload optional supporting files
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("label", "Supporting attachment");
        await fetch(`/api/v1/contractor-requests/${requestId}/files`, {
          method: "POST",
          body: formData,
        });
      }

      router.push("/contractors/requests/mine");
    } catch {
      setError("An unexpected network error occurred.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
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
        <span className="font-semibold text-slate-900 dark:text-slate-100">Suggest New Contractor</span>
      </div>

      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Suggest a Contractor</h1>
            <p className="text-xs text-slate-500">
              Recommend a company or tradesperson for organization use. A coordinator will review and verify credentials.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Live Duplicate Warning */}
        {duplicateMatches.length > 0 && (
          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Existing Contractor Found
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              This contractor may already be in our directory. Please check:
            </p>
            <div className="space-y-1.5 pt-1">
              {duplicateMatches.map((dup) => (
                <div
                  key={dup.id}
                  className="p-2 bg-white/80 dark:bg-slate-900/80 rounded-lg border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dup.companyName} {dup.suburb ? `(${dup.suburb})` : ""}
                  </span>
                  <Link href={`/contractors/${dup.id}`} target="_blank">
                    <Button variant="ghost" size="sm" className="text-xs text-indigo-600">
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
          <FormField label="Company / Business Name" required>
            <input
              type="text"
              required
              placeholder="e.g. Reliable Plumbing & Drainage"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Trading Name (if different)">
              <input
                type="text"
                placeholder="e.g. Quick Drain Pros"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="ABN / Registration Number (optional)">
              <input
                type="text"
                placeholder="e.g. 11 222 333 444"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-mono dark:bg-slate-950"
              />
            </FormField>
          </div>

          {/* Trade Selection */}
          <div className="space-y-2 pt-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Applicable Trades (Select all that apply)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {trades.map((tr) => {
                const isSelected = selectedTrades.includes(tr.id);
                return (
                  <div
                    key={tr.id}
                    onClick={() => handleToggleTrade(tr.id)}
                    className={`p-2 rounded-xl border cursor-pointer flex items-center justify-between text-xs transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span>{tr.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contact Representative */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Contact Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Contact Person">
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Phone Number">
                <input
                  type="text"
                  placeholder="e.g. 0412 345 678"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Email Address">
                <input
                  type="email"
                  placeholder="e.g. john@reliable.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Suburb / Base Location">
                <input
                  type="text"
                  placeholder="e.g. Parramatta"
                  value={suburb}
                  onChange={(e) => setSuburb(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Website">
                <input
                  type="text"
                  placeholder="https://..."
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>
          </div>

          {/* Note / Recommendation Reason */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <FormField label="Why this contractor? Who recommended them?" required>
              <textarea
                rows={3}
                required
                maxLength={2000}
                placeholder="Share any past experience, who referred them, quality of work, pricing fairness..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>

            {/* Supporting Photos / PDFs */}
            <div className="space-y-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                Attach Business Card, Quote or Brochure (Max 3 files)
              </span>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={handleFileChange}
                disabled={files.length >= 3}
                className="text-xs"
              />
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="truncate max-w-[140px]">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(i)}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link href="/contractors">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting Request..." : "Submit Suggestion"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
