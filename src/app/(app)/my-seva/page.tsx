"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  MessageSquare,
  Camera,
  Calendar,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Tabs } from "@/core/ui-kit/Tabs";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { format, isBefore, startOfDay, isToday, isThisWeek } from "date-fns";

export default function MySevaPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMySeva = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/occurrences?mine=true&pageSize=100");
      if (res.ok) {
        const json = await res.json();
        setOccurrences(json.data || []);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMySeva();
  }, []);

  const handleUpdateStatus = async (id: string, status: string, expectedVersion: number) => {
    try {
      const res = await fetch(`/api/v1/occurrences/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedVersion }),
      });
      if (res.ok) {
        loadMySeva();
      }
    } catch {}
  };

  const todayStart = startOfDay(new Date());

  // Group by timeframe
  const overdueItems = occurrences.filter(
    (o) => isBefore(new Date(o.dueDate), todayStart) && o.status !== "DONE" && o.status !== "SKIPPED"
  );
  const todayItems = occurrences.filter(
    (o) => isToday(new Date(o.dueDate)) && o.status !== "DONE"
  );
  const thisWeekItems = occurrences.filter(
    (o) => isThisWeek(new Date(o.dueDate), { weekStartsOn: 1 }) && !isToday(new Date(o.dueDate)) && o.status !== "DONE"
  );
  const completedItems = occurrences.filter((o) => o.status === "DONE");

  const tabs = [
    { id: "all", label: "All Tasks", count: occurrences.length },
    { id: "overdue", label: "Overdue", count: overdueItems.length },
    { id: "today", label: "Today", count: todayItems.length },
    { id: "week", label: "This Week", count: thisWeekItems.length },
    { id: "done", label: "Completed", count: completedItems.length },
  ];

  const displayedItems =
    activeTab === "overdue"
      ? overdueItems
      : activeTab === "today"
      ? todayItems
      : activeTab === "week"
      ? thisWeekItems
      : activeTab === "done"
      ? completedItems
      : occurrences;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CheckSquare className="w-6 h-6 text-indigo-600" /> My Assigned Seva
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Tasks and occurrences directly assigned to you for maintenance and completion
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {displayedItems.length === 0 ? (
        <EmptyState
          title="No tasks in this view"
          description="You have no assigned tasks under the selected category filter."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {displayedItems.map((occ) => {
            const isOccOverdue =
              isBefore(new Date(occ.dueDate), todayStart) && occ.status !== "DONE" && occ.status !== "SKIPPED";

            return (
              <div
                key={occ.id}
                className={`p-4 bg-white dark:bg-slate-900 rounded-xl border shadow-sm flex flex-col justify-between gap-3 ${
                  isOccOverdue
                    ? "border-red-300 dark:border-red-900/60 bg-red-50/20"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {occ.seva.code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        size="sm"
                        variant={
                          occ.status === "DONE"
                            ? "success"
                            : occ.status === "IN_PROGRESS"
                            ? "info"
                            : isOccOverdue
                            ? "danger"
                            : "warning"
                        }
                      >
                        {isOccOverdue ? "OVERDUE" : occ.status}
                      </Badge>
                      <Badge size="sm" variant={occ.seva.priority === "URGENT" ? "danger" : "neutral"}>
                        {occ.seva.priority}
                      </Badge>
                    </div>
                  </div>

                  <Link
                    href={`/seva/${occ.seva.id}`}
                    className="font-semibold text-sm text-slate-900 dark:text-slate-100 hover:underline line-clamp-1"
                  >
                    {occ.seva.title}
                  </Link>

                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>Due: {format(new Date(occ.dueDate), "dd MMM yyyy")}</span>
                    <span>•</span>
                    <span>{occ.seva.area?.name}</span>
                  </div>
                </div>

                {/* Quick Actions Strip */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/seva/${occ.seva.id}?tab=comments`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Add Comment"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/seva/${occ.seva.id}?tab=files`}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Upload Photo / Proof"
                    >
                      <Camera className="w-4 h-4" />
                    </Link>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {occ.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUpdateStatus(occ.id, "IN_PROGRESS", occ.version)}
                        icon={<Play className="w-3.5 h-3.5 text-indigo-600" />}
                      >
                        Start
                      </Button>
                    )}

                    {occ.status !== "DONE" && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleUpdateStatus(occ.id, "DONE", occ.version)}
                        icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      >
                        Mark Done
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
