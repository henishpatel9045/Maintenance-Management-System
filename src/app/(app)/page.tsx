"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Plus,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Briefcase,
  ShieldAlert,
  Inbox,
} from "lucide-react";
import { StatCard } from "@/core/ui-kit/StatCard";
import { FilterBar } from "@/core/ui-kit/FilterBar";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { CardSkeleton } from "@/core/ui-kit/Skeleton";
import { EmptyState } from "@/core/ui-kit/EmptyState";
import { SevaFormModal } from "@/modules/seva/components/SevaFormModal";
import { useCurrentUser } from "@/core/auth/useCurrentUser";
import {
  LicenceExpiringWidget,
  LicenceBelowTargetWidget,
  LicencePendingVerificationsWidget,
  LicenceQuickLookupWidget,
} from "@/modules/licences/components/LicenceWidgets";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { format } from "date-fns";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filters
  const [datePreset, setDatePreset] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);

  // Contractor widgets state
  const { user, hasPermission } = useCurrentUser();
  const isAdminOrCoordinator = user?.role === "ADMIN" || user?.role === "COORDINATOR";

  const canReadFullContractors = hasPermission("contractors.readFull");
  const canCredentialsView = hasPermission("contractors.credentials.view");
  const canReviewRequests = hasPermission("contractors.requests.review") || isAdminOrCoordinator;

  // Licences widgets state & permissions
  const canLicenceDirectory = hasPermission("licences.directory.view") || isAdminOrCoordinator;
  const canLicenceVerify = hasPermission("licences.verify") || isAdminOrCoordinator;

  const [expiringCredentials, setExpiringCredentials] = useState<any[]>([]);
  const [topContractorsSpend, setTopContractorsSpend] = useState<any[]>([]);
  const [openRequestsCount, setOpenRequestsCount] = useState<number>(0);
  const [openSevaRequestsCount, setOpenSevaRequestsCount] = useState<number>(0);
  const [pendingLicencesCount, setPendingLicencesCount] = useState<number>(0);

  // Open lists
  const [needsAttention, setNeedsAttention] = useState<any[]>([]);
  const [dueSoon, setDueSoon] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [mySevas, setMySevas] = useState<any[]>([]);

  useEffect(() => {
    // Load categories & areas
    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.data?.map((c: any) => ({ label: c.name, value: c.id })) || []))
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data?.map((a: any) => ({ label: a.name, value: a.id })) || []))
      .catch(() => {});
  }, []);

  const loadDashboard = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (selectedArea) params.set("areaId", selectedArea);
      if (selectedPriority) params.set("priority", selectedPriority);

      // Apply date preset
      if (datePreset === "today") {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        params.set("from", todayStr);
        params.set("to", todayStr);
      } else if (datePreset === "this_week") {
        const now = new Date();
        const start = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        const end = new Date(now.setDate(now.getDate() - now.getDay() + 7));
        params.set("from", format(start, "yyyy-MM-dd"));
        params.set("to", format(end, "yyyy-MM-dd"));
      }

      const res = await fetch(`/api/v1/dashboard/kpis?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }

      // Fetch Needs Attention & Due Soon
      const occRes = await fetch("/api/v1/occurrences?isOverdue=true&pageSize=5");
      if (occRes.ok) {
        const j = await occRes.json();
        setNeedsAttention(j.data || []);
      }

      const upRes = await fetch("/api/v1/occurrences/upcoming?days=7");
      if (upRes.ok) {
        const j = await upRes.json();
        const flat = (j.data || []).flatMap((d: any) => d.items);
        setDueSoon(flat.slice(0, 5));
      }

      // Fetch My Seva strip
      const myRes = await fetch("/api/v1/occurrences?mine=true&pageSize=5");
      if (myRes.ok) {
        const j = await myRes.json();
        setMySevas(j.data || []);
      }

      // Fetch Recent Activity
      const actRes = await fetch("/api/v1/audit?pageSize=6");
      if (actRes.ok) {
        const j = await actRes.json();
        setRecentActivity(j.data || []);
      }

      // Fetch Contractor widgets if permitted
      if (canCredentialsView) {
        fetch("/api/v1/contractors/reports/credentials?expiringWithinDays=30")
          .then((r) => r.json())
          .then((j) => setExpiringCredentials((j.data || []).slice(0, 5)))
          .catch(() => {});
      }
      if (canReadFullContractors) {
        fetch("/api/v1/contractors/reports/spend")
          .then((r) => r.json())
          .then((j) => setTopContractorsSpend((j.data?.byContractor || []).slice(0, 5)))
          .catch(() => {});
      }
      if (canReviewRequests || isAdminOrCoordinator) {
        fetch("/api/v1/contractor-requests?status=OPEN&limit=100")
          .then((r) => r.json())
          .then((j) => setOpenRequestsCount(j.data?.length || 0))
          .catch(() => {});
      }
      if (isAdminOrCoordinator) {
        fetch("/api/v1/requests")
          .then((r) => r.json())
          .then((j) => {
            const open = (j.data || []).filter((req: any) => req.status === "OPEN");
            setOpenSevaRequestsCount(open.length);
          })
          .catch(() => {});

        fetch("/api/v1/licences/pending")
          .then((r) => r.json())
          .then((j) => setPendingLicencesCount(j.data?.length || 0))
          .catch(() => {});
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [datePreset, selectedCategory, selectedArea, selectedPriority]);

  const metrics = data?.metrics || {
    total: 0,
    done: 0,
    inProgress: 0,
    pending: 0,
    overdue: 0,
    completionPercent: 0,
    onTimePercent: 0,
    dueToday: 0,
    dueThisWeek: 0,
    totalBudget: 0,
    totalSpend: 0,
  };

  const charts = data?.charts || {};

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Maintenance Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time performance indicators, active tasks, and maintenance workload
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsFormOpen(true)}
          icon={<Plus className="w-4 h-4" />}
        >
          Create Seva
        </Button>
      </div>

      {/* Filter Bar */}
      <FilterBar
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        categories={categories}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        areas={areas}
        selectedArea={selectedArea}
        onAreaChange={setSelectedArea}
        onReset={() => {
          setDatePreset("all");
          setSelectedCategory("");
          setSelectedArea("");
          setSelectedPriority("");
        }}
      />

      {/* Management Action & Approval Hub for Admins & Coordinators */}
      {isAdminOrCoordinator && (openSevaRequestsCount > 0 || openRequestsCount > 0 || pendingLicencesCount > 0) && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-200 dark:border-amber-900/60 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Pending Community Requests & Approvals
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Review and verify submitted items before they become active in the system
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Seva Requests */}
            <Link
              href="/requests"
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-500">Seva Maintenance Requests</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{openSevaRequestsCount}</span>
                  {openSevaRequestsCount > 0 ? (
                    <Badge size="sm" variant="warning">Awaiting Conversion</Badge>
                  ) : (
                    <Badge size="sm" variant="neutral">All Clear</Badge>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Contractor Suggestions */}
            <Link
              href="/contractors/requests"
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-500">Contractor Proposals</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{openRequestsCount}</span>
                  {openRequestsCount > 0 ? (
                    <Badge size="sm" variant="info">In Review Queue</Badge>
                  ) : (
                    <Badge size="sm" variant="neutral">All Clear</Badge>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </Link>

            {/* Pending Licences */}
            <Link
              href="/licences?tab=verify"
              className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all flex items-center justify-between group"
            >
              <div className="space-y-0.5">
                <div className="text-[11px] font-semibold text-slate-500">Volunteer Licences</div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>{pendingLicencesCount}</span>
                  {pendingLicencesCount > 0 ? (
                    <Badge size="sm" variant="danger">Needs Verification</Badge>
                  ) : (
                    <Badge size="sm" variant="neutral">All Clear</Badge>
                  )}
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      )}

      {/* "My Seva" Quick Strip */}
      {mySevas.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" /> My Assigned Work
            </span>
            <Link href="/my-seva" className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {mySevas.map((occ) => (
              <Link
                key={occ.id}
                href={`/seva/${occ.seva.id}`}
                className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition-colors text-xs"
              >
                <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {occ.seva.code}: {occ.seva.title}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Due: {format(new Date(occ.dueDate), "dd MMM")}</span>
                  <Badge size="sm" variant={occ.status === "DONE" ? "success" : occ.status === "IN_PROGRESS" ? "info" : "warning"}>
                    {occ.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI Stat Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Jobs" value={metrics.total} color="indigo" icon={<Layers className="w-4 h-4" />} />
          <StatCard label="Completed" value={metrics.done} subValue={`${metrics.completionPercent}%`} color="emerald" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatCard label="In Progress" value={metrics.inProgress} color="sky" icon={<Clock className="w-4 h-4" />} />
          <StatCard label="Overdue" value={metrics.overdue} color="rose" icon={<AlertTriangle className="w-4 h-4" />} />
          <StatCard label="Due Today" value={metrics.dueToday} color="amber" icon={<Calendar className="w-4 h-4" />} />
          <StatCard
            label="Spend / Budget"
            value={`$${metrics.totalSpend}`}
            subValue={`of $${metrics.totalBudget}`}
            color="indigo"
            icon={<DollarSign className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Visual Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution Donut */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Status Breakdown
          </h2>
          <div className="h-56 w-full flex items-center justify-center">
            {charts.statusDonut && charts.statusDonut.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.statusDonut}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {charts.statusDonut.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span className="text-xs text-slate-400">No status data</span>
            )}
          </div>
        </div>

        {/* Workload per Assignee */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Workload per Assignee
          </h2>
          <div className="h-56 w-full">
            {charts.workloadPerAssignee && charts.workloadPerAssignee.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.workloadPerAssignee}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="name" fontSize={10} tickLine={false} />
                  <YAxis fontSize={10} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="assigned" fill="#6366f1" name="Assigned" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="done" fill="#10b981" name="Done" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No assignee data</div>
            )}
          </div>
        </div>

        {/* Jobs by Category */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <h2 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Jobs by Category
          </h2>
          <div className="h-56 w-full">
            {charts.byCategory && charts.byCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" fontSize={10} />
                  <YAxis type="category" dataKey="label" fontSize={10} width={75} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No category data</div>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Grid: Needs Attention & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Needs Attention */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> Needs Immediate Attention ({needsAttention.length})
            </h2>
            <Link href="/seva?isOverdue=true" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              View all overdue
            </Link>
          </div>

          {needsAttention.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">All tasks are currently on schedule!</p>
          ) : (
            <div className="space-y-2">
              {needsAttention.map((occ) => (
                <Link
                  key={occ.id}
                  href={`/seva/${occ.seva.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 hover:bg-red-50 text-xs transition-colors"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {occ.seva.code}: {occ.seva.title}
                    </span>
                    <div className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                      Overdue since {format(new Date(occ.dueDate), "dd MMM yyyy")}
                    </div>
                  </div>
                  <Badge size="sm" variant="danger">
                    {occ.seva.priority}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity Timeline */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600" /> Recent System Activity
            </h2>
            <Link href="/admin?tab=audit" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Full audit log
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentActivity.map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 text-xs pb-2 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                <div className="flex-1 truncate">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{act.user?.name || "System"}</span>{" "}
                  <span className="text-slate-600 dark:text-slate-400">{act.action.replace(/_/g, " ").toLowerCase()}</span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {format(new Date(act.createdAt), "dd MMM HH:mm")} • {act.entityType}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contractor Operations & Compliance Row */}
      {(canCredentialsView || canReadFullContractors || canReviewRequests) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Expiring Credentials Widget */}
          {canCredentialsView && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Expiring Credentials (30d)
                </span>
                <Link href="/contractors" className="text-xs text-indigo-600 hover:underline">
                  View all
                </Link>
              </div>
              {expiringCredentials.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">All contractor credentials and policies are current.</p>
              ) : (
                <div className="space-y-2">
                  {expiringCredentials.map((cred) => (
                    <div key={cred.id} className="p-2 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-lg text-xs flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{cred.contractor?.companyName}</div>
                        <div className="text-[10px] text-amber-700 dark:text-amber-300">{cred.type} (Expires {cred.expiresAt ? format(new Date(cred.expiresAt), "dd MMM") : ""})</div>
                      </div>
                      <Badge size="sm" variant="warning">EXPIRING</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Top Contractor Spend */}
          {canReadFullContractors && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Top Contractor Spend
                </span>
                <Link href="/contractors" className="text-xs text-indigo-600 hover:underline">
                  Directory
                </Link>
              </div>
              {topContractorsSpend.length === 0 ? (
                <p className="text-xs text-slate-400 py-3">No contractor expenditure recorded.</p>
              ) : (
                <div className="space-y-2">
                  {topContractorsSpend.map((cs, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800 last:border-b-0">
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[160px]">{cs.contractorName}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">${Number(cs.totalInvoiced || 0).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Open Contractor Proposals */}
          {canReviewRequests && (
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-indigo-600" /> Open Contractor Proposals
                </span>
                <Link href="/contractors/requests" className="text-xs text-indigo-600 hover:underline">
                  Queue ({openRequestsCount})
                </Link>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center space-y-2">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{openRequestsCount}</div>
                <p className="text-xs text-slate-500">Proposals waiting for coordinator verification & approval</p>
                <Link href="/contractors/requests">
                  <Button size="sm" variant="secondary" className="mt-1">
                    Open Review Queue
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Licence & Skills Operations Row */}
      {(canLicenceDirectory || canLicenceVerify) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {canLicenceDirectory && <LicenceExpiringWidget />}
          {canLicenceDirectory && <LicenceBelowTargetWidget />}
          {canLicenceVerify && <LicencePendingVerificationsWidget />}
          {canLicenceDirectory && <LicenceQuickLookupWidget />}
        </div>
      )}

      {/* Seva Form Modal */}
      <SevaFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={loadDashboard}
      />
    </div>
  );
}
