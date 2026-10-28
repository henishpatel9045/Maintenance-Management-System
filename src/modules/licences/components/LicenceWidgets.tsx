"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Award, AlertTriangle, Clock, Users, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Badge } from "@/core/ui-kit/Badge";
import { Button } from "@/core/ui-kit/Button";
import { format } from "date-fns";

export function LicenceExpiringWidget() {
  const [expiring, setExpiring] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/licence-directory?expiringWithinDays=30&limit=5")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          // Extract user licences expiring
          const items: any[] = [];
          for (const user of j.data) {
            for (const lic of user.licences || []) {
              if (lic.status === "EXPIRING_SOON") {
                items.push({
                  userName: user.name,
                  licenceName: lic.licenceType?.name || "Licence",
                  class: lic.class,
                  expiryMonth: lic.expiryMonth,
                });
              }
            }
          }
          setExpiring(items.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Licences Expiring (30d)
        </span>
        <Link href="/licences" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          Directory
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-3">Checking licence expiries...</p>
      ) : expiring.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          No volunteer licences expiring within 30 days.
        </p>
      ) : (
        <div className="space-y-2">
          {expiring.map((item, idx) => (
            <div
              key={idx}
              className="p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-lg text-xs flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{item.userName}</div>
                <div className="text-[10px] text-amber-700 dark:text-amber-300">
                  {item.licenceName} {item.class ? `(${item.class})` : ""} • Expires {item.expiryMonth || "Soon"}
                </div>
              </div>
              <Badge size="sm" variant="warning">EXPIRING</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LicenceBelowTargetWidget() {
  const [shortfalls, setShortfalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/licence-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          const below = j.data.filter((t: any) => t.isBelowTarget);
          setShortfalls(below.slice(0, 5));
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Skills Below Target
        </span>
        <Link href="/licences" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
          View Summary
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400 py-3">Analyzing target coverage...</p>
      ) : shortfalls.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          All required skills and tickets meet organisational targets.
        </p>
      ) : (
        <div className="space-y-2">
          {shortfalls.map((s) => (
            <div
              key={s.id}
              className="p-2 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-lg text-xs flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                <div className="text-[10px] text-rose-700 dark:text-rose-300">
                  {s.validHolders} valid of {s.minHoldersTarget} target (deficit: -{s.shortfall})
                </div>
              </div>
              <Badge size="sm" variant="danger">DEFICIT -{s.shortfall}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LicencePendingVerificationsWidget() {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/licences/pending")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          setPendingCount(j.data.length);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600" /> Pending Licence Queue
        </span>
        <Link href="/licences" className="text-xs text-indigo-600 hover:underline">
          Review Queue
        </Link>
      </div>
      <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center space-y-2">
        <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{pendingCount}</div>
        <p className="text-xs text-slate-500">
          Volunteer submissions awaiting coordinator or admin verification
        </p>
        <Link href="/licences">
          <Button size="sm" variant="secondary" className="mt-1">
            Open Verification Queue
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function LicenceQuickLookupWidget() {
  const [types, setTypes] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetch("/api/v1/licence-types")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data && j.data.length > 0) {
          setTypes(j.data);
          setSelectedTypeId(j.data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLookup = async (typeId: string) => {
    setSelectedTypeId(typeId);
    if (!typeId) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/v1/licence-directory?licenceTypeId=${typeId}&availability=AVAILABLE&status=VALID&limit=4`);
      if (res.ok) {
        const j = await res.json();
        setResults(j.data || []);
      }
    } catch {} finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (selectedTypeId) {
      handleLookup(selectedTypeId);
    }
  }, [selectedTypeId]);

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-600" /> Available People Quick Lookup
        </span>
        <Link href="/licences" className="text-xs text-indigo-600 hover:underline">
          Advanced Search
        </Link>
      </div>

      <div className="space-y-2">
        <select
          value={selectedTypeId}
          onChange={(e) => handleLookup(e.target.value)}
          className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {isSearching ? (
          <p className="text-xs text-slate-400 py-2">Searching available holders...</p>
        ) : results.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No available members currently hold this licence.</p>
        ) : (
          <div className="space-y-1.5">
            {results.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                    {u.name?.charAt(0)}
                  </div>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{u.name}</span>
                </div>
                <Badge size="sm" variant="success">AVAILABLE</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
