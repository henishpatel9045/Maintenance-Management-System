"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { format } from "date-fns";

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/notifications");
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data.notifications || []);
        setUnreadCount(json.data.unreadCount || 0);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const markRead = async (id: string) => {
    try {
      await fetch(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      loadNotifications();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/v1/notifications/read-all", { method: "POST" });
      loadNotifications();
    } catch {}
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bell className="w-6 h-6 text-indigo-600" /> Notifications Center
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time updates regarding assignments, comments, due dates, and status changes
          </p>
        </div>

        {unreadCount > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead} icon={<Check className="w-3.5 h-3.5" />}>
            Mark All Read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState title="No notifications" description="You're all caught up! No recent alerts or mentions." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                !n.readAt
                  ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {!n.readAt && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{n.title}</span>
                  <span className="text-[10px] text-slate-400">
                    {format(new Date(n.createdAt), "dd MMM HH:mm")}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{n.body}</p>
                {n.linkUrl && (
                  <Link
                    href={n.linkUrl}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline pt-1"
                  >
                    View Details <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {!n.readAt && (
                <button
                  onClick={() => markRead(n.id)}
                  className="p-1 rounded text-slate-400 hover:text-indigo-600 text-xs font-medium"
                  title="Mark as read"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
