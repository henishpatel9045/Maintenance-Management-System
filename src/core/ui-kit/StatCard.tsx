import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  color?: string;
  onClick?: () => void;
}

export function StatCard({ label, value, subValue, icon, color = "indigo", onClick }: StatCardProps) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    indigo: { bg: "bg-indigo-50 dark:bg-indigo-950/50", text: "text-indigo-600 dark:text-indigo-400" },
    emerald: { bg: "bg-emerald-50 dark:bg-emerald-950/50", text: "text-emerald-600 dark:text-emerald-400" },
    amber: { bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400" },
    rose: { bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400" },
    sky: { bg: "bg-sky-50 dark:bg-sky-950/50", text: "text-sky-600 dark:text-sky-400" },
    slate: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  };

  const scheme = colorMap[color] || colorMap.indigo!;

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-all ${
        onClick ? "cursor-pointer active:scale-[0.99]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        {icon && <div className={`p-2 rounded-lg ${scheme.bg} ${scheme.text}`}>{icon}</div>}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
        {subValue && <span className="text-xs text-slate-500 dark:text-slate-400">{subValue}</span>}
      </div>
    </div>
  );
}
