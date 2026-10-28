"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderTree,
  Folder,
  FileText,
  Download,
  Search,
  Eye,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { EmptyState } from "@/core/ui-kit/EmptyState";

export default function FileLibraryPage() {
  const [treeData, setTreeData] = useState<any[]>([]);
  const [selectedSevaId, setSelectedSevaId] = useState<string | null>(null);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"ALL" | "QUOTE" | "ARTEFACT">("ALL");

  useEffect(() => {
    fetch("/api/v1/files/tree")
      .then((r) => r.json())
      .then((j) => {
        setTreeData(j.data || []);
        if (j.data?.[0]) {
          setSelectedSevaId(j.data[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSevaId) return;
    fetch(`/api/v1/seva/${selectedSevaId}/files`)
      .then((r) => r.json())
      .then((j) => setSelectedFolderFiles(j.data || []))
      .catch(() => {});
  }, [selectedSevaId]);

  const filteredFiles = selectedFolderFiles.filter((f) => {
    if (bucketFilter !== "ALL" && f.bucket !== bucketFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = f.fileObject.originalName.toLowerCase().includes(q);
      const matchCap = f.caption?.toLowerCase().includes(q);
      const matchSup = f.supplierName?.toLowerCase().includes(q);
      return matchName || matchCap || matchSup;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderTree className="w-6 h-6 text-indigo-600" /> Central File Library
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Hierarchical folder tree of quotation documents, completion proofs, and photos
          </p>
        </div>

        {selectedSevaId && (
          <a href={`/api/v1/seva/${selectedSevaId}/files.zip`} download>
            <Button size="sm" variant="outline" icon={<Download className="w-3.5 h-3.5" />}>
              Download Folder ZIP
            </Button>
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Hierarchical Folder Tree */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Project Folder Tree
          </span>

          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {treeData.map((node) => (
              <FileTreeNode
                key={node.id}
                node={node}
                selectedId={selectedSevaId}
                onSelect={(id) => setSelectedSevaId(id)}
              />
            ))}
          </div>
        </div>

        {/* Right Column: Files Grid & Explorer */}
        <div className="lg:col-span-2 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Bucket:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
                {(["ALL", "ARTEFACT", "QUOTE"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBucketFilter(b)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      bucketFilter === b ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {b === "ALL" ? "All Files" : b === "QUOTE" ? "Quotes" : "Artefacts"}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              placeholder="Filter files in folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          {filteredFiles.length === 0 ? (
            <EmptyState
              title="No files in this folder"
              description="Upload files directly from the Seva detail view or select another folder."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between gap-2"
                >
                  <div>
                    {file.fileObject.mimeType.startsWith("image/") ? (
                      <img
                        src={`/api/v1/files/${file.id}/download`}
                        alt={file.caption || file.fileObject.originalName}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-full h-24 bg-indigo-50 dark:bg-slate-700 rounded-lg flex items-center justify-center text-indigo-500">
                        <FileText className="w-8 h-8" />
                      </div>
                    )}

                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate mt-2">
                      {file.label || file.fileObject.originalName}
                    </div>

                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {file.bucket} {file.amount ? `• $${file.amount}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400">
                      {(Number(file.fileObject.sizeBytes) / 1024).toFixed(0)} KB
                    </span>
                    <a
                      href={`/api/v1/files/${file.id}/download`}
                      download
                      className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <Download className="w-3 h-3" /> Get
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FileTreeNode({
  node,
  selectedId,
  onSelect,
}: {
  node: any;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs cursor-pointer transition-colors ${
          isSelected
            ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate pr-2">
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(!isOpen);
              }}
              className="p-0.5 rounded text-slate-400"
            >
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5" />
          )}

          <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="truncate">{node.code}: {node.title}</span>
        </div>

        <span className="text-[10px] text-slate-400 shrink-0">
          Q:{node.quotesCount} | A:{node.artefactsCount}
        </span>
      </div>

      {hasChildren && isOpen && (
        <div className="pl-4 mt-0.5">
          {node.children.map((child: any) => (
            <FileTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
