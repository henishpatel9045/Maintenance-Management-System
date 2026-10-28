"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronRight,
  AlertTriangle,
  Building,
  DollarSign,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { FormField } from "@/core/ui-kit/FormField";
import { useCurrentUser } from "@/core/auth/useCurrentUser";

export default function EditContractorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const contractorId = resolvedParams.id;
  const router = useRouter();
  const { hasPermission } = useCurrentUser();
  const canWrite = hasPermission("contractors.write");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contractorVersion, setContractorVersion] = useState<number>(1);
  const [trades, setTrades] = useState<any[]>([]);

  // Form Data
  const [formData, setFormData] = useState({
    companyName: "",
    tradingName: "",
    registrationNumber: "",
    registrationType: "ABN",
    gstRegistered: true,
    status: "ACTIVE",
    isPreferred: false,
    afterHoursAvailable: false,
    website: "",
    mainPhone: "",
    mainEmail: "",
    emergencyPhone: "",
    addressLine1: "",
    addressLine2: "",
    suburb: "",
    state: "",
    postcode: "",
    country: "AU",
    serviceAreas: "",
    paymentTerms: "Net 30",
    callOutFee: "",
    hourlyRate: "",
    currency: "AUD",
    internalNotes: "",
    tags: "",
  });

  const [selectedTrades, setSelectedTrades] = useState<{ tradeId: string; isPrimary: boolean }[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/trades").then((r) => r.json()),
      fetch(`/api/v1/contractors/${contractorId}`).then((r) => r.json()),
    ])
      .then(([tradesJson, cJson]) => {
        setTrades(tradesJson.data || []);
        if (cJson.data) {
          const c = cJson.data;
          setContractorVersion(c.version || 1);
          setFormData({
            companyName: c.companyName || "",
            tradingName: c.tradingName || "",
            registrationNumber: c.registrationNumber || "",
            registrationType: c.registrationType || "ABN",
            gstRegistered: c.gstRegistered ?? true,
            status: c.status || "ACTIVE",
            isPreferred: c.isPreferred ?? false,
            afterHoursAvailable: c.afterHoursAvailable ?? false,
            website: c.website || "",
            mainPhone: c.mainPhone || "",
            mainEmail: c.mainEmail || "",
            emergencyPhone: c.emergencyPhone || "",
            addressLine1: c.addressLine1 || "",
            addressLine2: c.addressLine2 || "",
            suburb: c.suburb || "",
            state: c.state || "",
            postcode: c.postcode || "",
            country: c.country || "AU",
            serviceAreas: Array.isArray(c.serviceAreas) ? c.serviceAreas.join(", ") : "",
            paymentTerms: c.paymentTerms || "Net 30",
            callOutFee: c.callOutFee != null ? String(c.callOutFee) : "",
            hourlyRate: c.hourlyRate != null ? String(c.hourlyRate) : "",
            currency: c.currency || "AUD",
            internalNotes: c.internalNotes || "",
            tags: Array.isArray(c.tags) ? c.tags.map((t: any) => t.label).join(", ") : "",
          });

          if (c.trades) {
            setSelectedTrades(
              c.trades.map((t: any) => ({
                tradeId: t.trade.id,
                isPrimary: t.isPrimary,
              }))
            );
          }
        }
      })
      .catch(() => setError("Failed to load contractor."))
      .finally(() => setIsLoading(false));
  }, [contractorId]);

  const handleToggleTrade = (tradeId: string) => {
    setSelectedTrades((prev) => {
      const exists = prev.find((t) => t.tradeId === tradeId);
      if (exists) {
        return prev.filter((t) => t.tradeId !== tradeId);
      } else {
        return [...prev, { tradeId, isPrimary: prev.length === 0 }];
      }
    });
  };

  const handleSetPrimaryTrade = (tradeId: string) => {
    setSelectedTrades((prev) =>
      prev.map((t) => ({ ...t, isPrimary: t.tradeId === tradeId }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName.trim()) {
      setError("Company Name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        ...formData,
        expectedVersion: contractorVersion,
        callOutFee: formData.callOutFee ? Number(formData.callOutFee) : null,
        hourlyRate: formData.hourlyRate ? Number(formData.hourlyRate) : null,
        serviceAreas: formData.serviceAreas
          ? formData.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        tags: formData.tags
          ? formData.tags.split(",").map((s) => s.trim().replace(/^#/, "")).filter(Boolean)
          : [],
      };

      const res = await fetch(`/api/v1/contractors/${contractorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status === 409) {
        setError("Conflict: This contractor record was modified by another user. Please reload the page to get the latest data.");
        setIsSubmitting(false);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json();
        setError(errJson.error?.message || "Failed to update contractor.");
        setIsSubmitting(false);
        return;
      }

      // Also update trades
      await fetch(`/api/v1/contractors/${contractorId}/trades`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trades: selectedTrades }),
      });

      router.push(`/contractors/${contractorId}`);
    } catch {
      setError("A network error occurred while updating.");
      setIsSubmitting(false);
    }
  };

  if (!canWrite) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Coordinators and Administrators can modify contractor records.
        </p>
        <Link href={`/contractors/${contractorId}/suggest-change`}>
          <Button variant="primary">Suggest a Change Instead</Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading contractor form...</div>;
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
        <Link href={`/contractors/${contractorId}`} className="hover:underline truncate max-w-[140px]">
          {formData.companyName || "Detail"}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-slate-100">Edit</span>
      </div>

      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Edit Contractor Details</h1>
            <p className="text-xs text-slate-500">
              Update legal identity, trades, contact numbers, and commercial rates.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6 text-xs">
          {/* Section: Business Identity */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" /> Business Identity
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Legal Company Name" required>
                <input
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Trading Name">
                <input
                  type="text"
                  value={formData.tradingName}
                  onChange={(e) => setFormData({ ...formData, tradingName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Registration Type">
                <select
                  value={formData.registrationType}
                  onChange={(e) => setFormData({ ...formData, registrationType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                >
                  <option value="ABN">Australian Business Number (ABN)</option>
                  <option value="ACN">Australian Company Number (ACN)</option>
                  <option value="NZBN">New Zealand Business Number (NZBN)</option>
                  <option value="OTHER">Other International / Regional</option>
                </select>
              </FormField>
              <FormField label="Registration Number">
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono dark:bg-slate-950"
                />
              </FormField>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={formData.gstRegistered}
                    onChange={(e) => setFormData({ ...formData, gstRegistered: e.target.checked })}
                  />
                  GST Registered Business
                </label>
              </div>
            </div>
          </div>

          {/* Section: Trades & Specialties */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" /> Trades & Capabilities
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {trades.map((tr) => {
                const assigned = selectedTrades.find((t) => t.tradeId === tr.id);
                return (
                  <div
                    key={tr.id}
                    onClick={() => handleToggleTrade(tr.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer text-xs flex flex-col justify-between transition-all ${
                      assigned
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{tr.name}</span>
                    {assigned && (
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-indigo-200 dark:border-indigo-900 text-[10px]">
                        {assigned.isPrimary ? (
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">Primary Trade</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimaryTrade(tr.id);
                            }}
                            className="hover:underline text-indigo-600"
                          >
                            Set Primary
                          </button>
                        )}
                        <CheckCircle2 className="w-3 h-3 text-indigo-600" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Contact & Location */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" /> Location & Contact Points
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Main Phone">
                <input
                  type="text"
                  value={formData.mainPhone}
                  onChange={(e) => setFormData({ ...formData, mainPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Main Email">
                <input
                  type="email"
                  value={formData.mainEmail}
                  onChange={(e) => setFormData({ ...formData, mainEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Website">
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Street Address Line 1">
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Street Address Line 2">
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <FormField label="Suburb">
                <input
                  type="text"
                  value={formData.suburb}
                  onChange={(e) => setFormData({ ...formData, suburb: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="State">
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Postcode">
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Country">
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <FormField label="Service Areas (comma-separated)">
              <input
                type="text"
                value={formData.serviceAreas}
                onChange={(e) => setFormData({ ...formData, serviceAreas: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
          </div>

          {/* Section: Operational Flags & Commercials */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" /> Commercial Terms & Flags
            </h2>

            <div className="flex flex-wrap items-center gap-6 py-2">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={formData.isPreferred}
                  onChange={(e) => setFormData({ ...formData, isPreferred: e.target.checked })}
                />
                Preferred Partner Organization
              </label>
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={formData.afterHoursAvailable}
                  onChange={(e) => setFormData({ ...formData, afterHoursAvailable: e.target.checked })}
                />
                24/7 After-Hours Available
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <FormField label="Emergency Phone">
                <input
                  type="text"
                  value={formData.emergencyPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Payment Terms">
                <input
                  type="text"
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Call-Out Fee ($)">
                <input
                  type="number"
                  value={formData.callOutFee}
                  onChange={(e) => setFormData({ ...formData, callOutFee: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
              <FormField label="Hourly Rate ($/hr)">
                <input
                  type="number"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
                />
              </FormField>
            </div>

            <FormField label="Internal Coordinator Notes (Restricted)">
              <textarea
                rows={3}
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>

            <FormField label="Tags / Keywords (comma-separated)">
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl dark:bg-slate-950"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link href={`/contractors/${contractorId}`}>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
