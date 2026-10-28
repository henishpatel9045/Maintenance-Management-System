"use client";

import React from "react";
import { Search, X, RotateCcw } from "lucide-react";
import { selectClass, inputClass } from "./FormField";
import { Button } from "./Button";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  categories?: FilterOption[];
  selectedCategory?: string;
  onCategoryChange?: (val: string) => void;
  areas?: FilterOption[];
  selectedArea?: string;
  onAreaChange?: (val: string) => void;
  priorities?: FilterOption[];
  selectedPriority?: string;
  onPriorityChange?: (val: string) => void;
  statuses?: FilterOption[];
  selectedStatus?: string;
  onStatusChange?: (val: string) => void;
  datePreset?: string;
  onDatePresetChange?: (val: string) => void;
  onReset?: () => void;
  extraControls?: React.ReactNode;
}

export function FilterBar({
  searchQuery = "",
  onSearchChange,
  categories = [],
  selectedCategory = "",
  onCategoryChange,
  areas = [],
  selectedArea = "",
  onAreaChange,
  priorities = [],
  selectedPriority = "",
  onPriorityChange,
  statuses = [],
  selectedStatus = "",
  onStatusChange,
  datePreset = "all",
  onDatePresetChange,
  onReset,
  extraControls,
}: FilterBarProps) {
  const hasActiveFilters =
    Boolean(searchQuery) ||
    Boolean(selectedCategory) ||
    Boolean(selectedArea) ||
    Boolean(selectedPriority) ||
    Boolean(selectedStatus) ||
    (datePreset && datePreset !== "all");

  return (
    <div className="flex flex-col gap-2.5 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm mb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        {onSearchChange && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, code or keyword..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className={`${inputClass} pl-9 pr-8 text-xs sm:text-sm`}
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Date presets */}
        {onDatePresetChange && (
          <select
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value)}
            className={`${selectClass} w-auto text-xs py-2`}
          >
            <option value="all">All Dates</option>
            <option value="today">Due Today</option>
            <option value="this_week">Due This Week</option>
            <option value="this_month">Due This Month</option>
            <option value="overdue">Overdue</option>
            <option value="next_30">Next 30 Days</option>
          </select>
        )}

        {/* Category select */}
        {categories.length > 0 && onCategoryChange && (
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className={`${selectClass} w-auto text-xs py-2`}
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}

        {/* Area select */}
        {areas.length > 0 && onAreaChange && (
          <select
            value={selectedArea}
            onChange={(e) => onAreaChange(e.target.value)}
            className={`${selectClass} w-auto text-xs py-2`}
          >
            <option value="">All Areas</option>
            {areas.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        )}

        {/* Priority select */}
        {priorities.length > 0 && onPriorityChange && (
          <select
            value={selectedPriority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className={`${selectClass} w-auto text-xs py-2`}
          >
            <option value="">All Priorities</option>
            {priorities.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        )}

        {/* Status select */}
        {statuses.length > 0 && onStatusChange && (
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className={`${selectClass} w-auto text-xs py-2`}
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {/* Reset */}
        {hasActiveFilters && onReset && (
          <Button variant="ghost" size="sm" onClick={onReset} icon={<RotateCcw className="w-3.5 h-3.5" />}>
            Reset
          </Button>
        )}

        {extraControls && <div className="ml-auto flex items-center gap-2">{extraControls}</div>}
      </div>
    </div>
  );
}
