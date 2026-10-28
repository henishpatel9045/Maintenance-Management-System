"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wrench,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Layers,
  Save,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField } from "@/core/ui-kit/FormField";
import { useCurrentUser } from "@/core/auth/useCurrentUser";

export default function TradesManagementPage() {
  const { hasPermission } = useCurrentUser();
  const canManage = hasPermission("contractors.manage");

  const [trades, setTrades] = useState<any[]>([]);
  const [categoryTrades, setCategoryTrades] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New / Edit Trade Modal
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<any>(null);
  const [tradeForm, setTradeForm] = useState({
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  // Category Mapping Modal
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedCategoryTradeIds, setSelectedCategoryTradeIds] = useState<string[]>([]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [trRes, catTrRes, catRes] = await Promise.all([
        fetch("/api/v1/trades"),
        fetch("/api/v1/category-trades"),
        fetch("/api/v1/masters/categories"),
      ]);

      if (trRes.ok) {
        const j = await trRes.json();
        setTrades(j.data || []);
      }
      if (catTrRes.ok) {
        const j = await catTrRes.json();
        setCategoryTrades(j.data || []);
      }
      if (catRes.ok) {
        const j = await catRes.json();
        setCategories(j.data || []);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManage) {
      loadData();
    }
  }, [canManage]);

  const handleSaveTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingTrade ? `/api/v1/trades/${editingTrade.id}` : "/api/v1/trades";
      const method = editingTrade ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeForm),
      });

      if (res.ok) {
        setIsTradeModalOpen(false);
        setEditingTrade(null);
        setTradeForm({ name: "", description: "", sortOrder: 0, isActive: true });
        loadData();
      }
    } catch {}
  };

  const handleOpenCategoryMapping = (category: any) => {
    setSelectedCategory(category);
    // Find all trades mapped to this category
    const currentMapped = categoryTrades
      .filter((ct) => ct.categoryId === category.id)
      .map((ct) => ct.tradeId);
    setSelectedCategoryTradeIds(currentMapped);
    setIsMappingModalOpen(true);
  };

  const handleToggleCategoryTrade = (tradeId: string) => {
    setSelectedCategoryTradeIds((prev) =>
      prev.includes(tradeId) ? prev.filter((id) => id !== tradeId) : [...prev, tradeId]
    );
  };

  const handleSaveCategoryMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    try {
      const res = await fetch("/api/v1/category-trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory.id,
          tradeIds: selectedCategoryTradeIds,
        }),
      });
      if (res.ok) {
        setIsMappingModalOpen(false);
        loadData();
      }
    } catch {}
  };

  if (!canManage) {
    return (
      <div className="p-8 text-center space-y-3">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">Access Restricted</h2>
        <p className="text-xs text-slate-500">
          Only Administrators with manage permissions can modify trade master settings.
        </p>
        <Link href="/contractors">
          <Button variant="secondary">Back to Directory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
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
        <span className="font-semibold text-slate-900 dark:text-slate-100">Trades & Category Mappings</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-indigo-600" /> Master Trades & Task Mapping
          </h1>
          <p className="text-xs text-slate-500">
            Configure the central trade taxonomy and map Seva task categories to relevant trades for intelligent auto-suggestions.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditingTrade(null);
            setTradeForm({ name: "", description: "", sortOrder: 0, isActive: true });
            setIsTradeModalOpen(true);
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add New Trade
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trades Master Table */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Master Trade Taxonomy ({trades.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Trade Name</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trades.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {tr.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 truncate max-w-[180px]">
                      {tr.description || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge size="sm" variant={tr.isActive ? "success" : "neutral"}>
                        {tr.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingTrade(tr);
                          setTradeForm({
                            name: tr.name,
                            description: tr.description || "",
                            sortOrder: tr.sortOrder || 0,
                            isActive: tr.isActive,
                          });
                          setIsTradeModalOpen(true);
                        }}
                      >
                        <Edit2 className="w-3 h-3 text-slate-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category to Trade Suggestions */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Seva Category to Trade Mapping
            </h2>
            <p className="text-xs text-slate-500">
              When a user adds contractors to a seva, contractors matching mapped trades will be recommended first.
            </p>
          </div>

          <div className="space-y-3">
            {categories.map((cat) => {
              const mapped = categoryTrades.filter((ct) => ct.categoryId === cat.id);
              return (
                <div
                  key={cat.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs gap-3"
                >
                  <div className="space-y-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                    <div className="flex flex-wrap gap-1">
                      {mapped.length > 0 ? (
                        mapped.map((m) => (
                          <span
                            key={m.id}
                            className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium"
                          >
                            {m.trade?.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">No mapped trades</span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-indigo-600 shrink-0"
                    onClick={() => handleOpenCategoryMapping(cat)}
                  >
                    Configure
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Trade Edit Modal */}
      {isTradeModalOpen && (
        <Modal
          isOpen={isTradeModalOpen}
          onClose={() => setIsTradeModalOpen(false)}
          title={editingTrade ? "Edit Trade" : "Add Master Trade"}
        >
          <form onSubmit={handleSaveTrade} className="space-y-3 text-xs">
            <FormField label="Trade Name" required>
              <input
                type="text"
                required
                placeholder="e.g. Electrical, Plumbing, HVAC"
                value={tradeForm.name}
                onChange={(e) => setTradeForm({ ...tradeForm, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <FormField label="Description">
              <textarea
                rows={2}
                value={tradeForm.description}
                onChange={(e) => setTradeForm({ ...tradeForm, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <FormField label="Sort Order">
              <input
                type="number"
                value={tradeForm.sortOrder}
                onChange={(e) => setTradeForm({ ...tradeForm, sortOrder: Number(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900"
              />
            </FormField>
            <label className="flex items-center gap-2 pt-1 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={tradeForm.isActive}
                onChange={(e) => setTradeForm({ ...tradeForm, isActive: e.target.checked })}
              />
              Active Trade in System
            </label>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsTradeModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Trade</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Category Mapping Modal */}
      {isMappingModalOpen && selectedCategory && (
        <Modal
          isOpen={isMappingModalOpen}
          onClose={() => setIsMappingModalOpen(false)}
          title={`Map Trades to "${selectedCategory.name}"`}
        >
          <form onSubmit={handleSaveCategoryMapping} className="space-y-4 text-xs">
            <p className="text-slate-500">
              Select which trades correspond to the <strong>{selectedCategory.name}</strong> task category.
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1">
              {trades.map((tr) => {
                const isSelected = selectedCategoryTradeIds.includes(tr.id);
                return (
                  <div
                    key={tr.id}
                    onClick={() => handleToggleCategoryTrade(tr.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <span>{tr.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsMappingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Mappings</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
