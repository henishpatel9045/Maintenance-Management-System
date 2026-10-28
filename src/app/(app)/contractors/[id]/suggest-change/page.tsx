"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Edit2,
  ChevronRight,
  Building,
  Phone,
  Mail,
  MapPin,
  FileText,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { FormField } from "@/core/ui-kit/FormField";

export default function SuggestChangePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contractorId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<any>(null);

  // Editable open-tier fields
  const [companyName, setCompanyName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [mainPhone, setMainPhone] = useState("");
  const [mainEmail, setMainEmail] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [afterHoursAvailable, setAfterHoursAvailable] = useState(false);
  const [paymentTerms, setPaymentTerms] = useState("");

  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetch(`/api/v1/contractors/${contractorId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          const c = j.data;
          setOriginal(c);
          setCompanyName(c.companyName || "");
          setTradingName(c.tradingName || "");
          setRegistrationNumber(c.registrationNumber || "");
          setMainPhone(c.mainPhone || "");
          setMainEmail(c.mainEmail || "");
          setEmergencyPhone(c.emergencyPhone || "");
          setWebsite(c.website || "");
          setAddressLine1(c.addressLine1 || "");
          setSuburb(c.suburb || "");
          setState(c.state || "");
          setPostcode(c.postcode || "");
          setAfterHoursAvailable(c.afterHoursAvailable ?? false);
          setPaymentTerms(c.paymentTerms || "");
        }
      })
      .catch(() => setError("Failed to load contractor."))
      .finally(() => setIsLoading(false));
  }, [contractorId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (files.length + newFiles.length > 3) {
      alert("Maximum 3 files allowed.");
      return;
    }
    setFiles((prev) => [...prev, ...newFiles].slice(0, 3));
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setError("Please describe why you are suggesting these changes.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Calculate diff: only store changed fields
    const proposedData: Record<string, any> = {};
    if (companyName.trim() !== (original.companyName || "")) proposedData.companyName = companyName.trim();
    if (tradingName.trim() !== (original.tradingName || "")) proposedData.tradingName = tradingName.trim();
    if (registrationNumber.trim() !== (original.registrationNumber || "")) proposedData.registrationNumber = registrationNumber.trim();
    if (mainPhone.trim() !== (original.mainPhone || "")) proposedData.mainPhone = mainPhone.trim();
    if (mainEmail.trim() !== (original.mainEmail || "")) proposedData.mainEmail = mainEmail.trim();
    if (emergencyPhone.trim() !== (original.emergencyPhone || "")) proposedData.emergencyPhone = emergencyPhone.trim();
    if (website.trim() !== (original.website || "")) proposedData.website = website.trim();
    if (addressLine1.trim() !== (original.addressLine1 || "")) proposedData.addressLine1 = addressLine1.trim();
    if (suburb.trim() !== (original.suburb || "")) proposedData.suburb = suburb.trim();
    if (state.trim() !== (original.state || "")) proposedData.state = state.trim();
    if (postcode.trim() !== (original.postcode || "")) proposedData.postcode = postcode.trim();
    if (afterHoursAvailable !== (original.afterHoursAvailable ?? false)) proposedData.afterHoursAvailable = afterHoursAvailable;
    if (paymentTerms.trim() !== (original.paymentTerms || "")) proposedData.paymentTerms = paymentTerms.trim();

    if (Object.keys(proposedData).length === 0) {
      setError("No fields were modified. Please edit at least one field to suggest a change.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/contractor-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "UPDATE_CONTRACTOR",
          contractorId,
          note: note.trim(),
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

      // Upload files
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("label", "Supporting proof");
        await fetch(`/api/v1/contractor-requests/${requestId}/files`, {
          method: "POST",
          body: formData,
        });
      }

      router.push("/contractors/requests/mine");
    } catch {
      setError("A network error occurred.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading contractor data...</div>;
  }

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
        <Link href={`/contractors/${contractorId}`} className="hover:underline truncate max-w-[140px]">
          {original?.companyName || "Detail"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">Suggest Change</span>
      </div>

      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Edit2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Suggest an Update</h1>
            <p className="text-xs text-slate-500">
              Propose updated contact numbers, address, or details for <strong>{original?.companyName}</strong>. A coordinator will verify.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-xs">
          <FormField label="Company Name">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Trading Name">
              <input
                type="text"
                value={tradingName}
                onChange={(e) => setTradingName(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="ABN / Registration #">
              <input
                type="text"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl font-mono dark:bg-slate-950"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Main Phone">
              <input
                type="text"
                value={mainPhone}
                onChange={(e) => setMainPhone(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Main Email">
              <input
                type="email"
                value={mainEmail}
                onChange={(e) => setMainEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Website">
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
          </div>

          <FormField label="Street Address">
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
            />
          </FormField>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Suburb">
              <input
                type="text"
                value={suburb}
                onChange={(e) => setSuburb(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="State">
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
            <FormField label="Postcode">
              <input
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
          </div>

          <div className="flex items-center gap-6 py-1">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={afterHoursAvailable}
                onChange={(e) => setAfterHoursAvailable(e.target.checked)}
              />
              24/7 After-Hours Available
            </label>
          </div>

          <FormField label="Reason for Change / Context" required>
            <textarea
              rows={3}
              required
              maxLength={2000}
              placeholder="e.g. Their phone number changed last week, or new business address..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
            />
          </FormField>

          {/* Supporting Files */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-slate-700 dark:text-slate-300 block">
              Attach Supporting Proof (Max 3 files)
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

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link href={`/contractors/${contractorId}`}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Change Proposal"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
