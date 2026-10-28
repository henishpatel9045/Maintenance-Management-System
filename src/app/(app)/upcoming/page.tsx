"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar as CalendarIcon, Clock, ChevronRight } from "lucide-react";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { format } from "date-fns";

export default function UpcomingSevaPage() {
  const [days, setDays] = useState(30);
  const [groupedDays, setGroupedDays] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadUpcoming = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/occurrences/upcoming?days=${days}`);
      if (res.ok) {
        const json = await res.json();
        setGroupedDays(json.data || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUpcoming();
  }, [days]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-indigo-600" /> Upcoming Maintenance Schedule
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Planned maintenance visits and occurrences grouped by calendar day
          </p>
        </div>

        {/* Days horizon selector */}
        <div className="inline-flex rounded-lg p-1 bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                days === d
                  ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Next {d} Days
            </button>
          ))}
        </div>
      </div>

      {groupedDays.length === 0 ? (
        <EmptyState
          title="No upcoming seva scheduled"
          description={`There are no maintenance tasks scheduled in the next ${days} days.`}
        />
      ) : (
        <div className="space-y-4">
          {groupedDays.map((dayGroup) => (
            <div key={dayGroup.date} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-14 bg-slate-50/90 dark:bg-slate-950/90 py-1 backdrop-blur-sm z-10">
                <span>{format(new Date(dayGroup.date), "EEEE, dd MMMM yyyy")}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
                  {dayGroup.count}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {dayGroup.items.map((occ: any) => (
                  <Link
                    key={occ.id}
                    href={`/seva/${occ.seva.id}`}
                    className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 rounded-xl shadow-sm transition-all flex items-center justify-between gap-3"
                  >
                    <div className="truncate">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs text-indigo-600">
                          {occ.seva.code}
                        </span>
                        <Badge size="sm" variant={occ.seva.priority === "URGENT" ? "danger" : "neutral"}>
                          {occ.seva.priority}
                        </Badge>
                      </div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {occ.seva.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {occ.seva.category?.name} • {occ.seva.area?.name}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
