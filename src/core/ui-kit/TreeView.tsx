"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Folder, FileText, CheckCircle2 } from "lucide-react";

export interface TreeNodeData {
  id: string;
  label: string;
  subLabel?: string;
  isLeaf?: boolean;
  progressPercent?: number;
  children?: TreeNodeData[];
}

export interface TreeViewProps {
  nodes: TreeNodeData[];
  selectedId?: string;
  onSelectNode?: (node: TreeNodeData) => void;
  className?: string;
}

export function TreeView({ nodes, selectedId, onSelectNode, className = "" }: TreeViewProps) {
  return (
    <div className={`space-y-1 font-sans ${className}`}>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelectNode={onSelectNode}
          level={0}
        />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  selectedId,
  onSelectNode,
  level,
}: {
  node: TreeNodeData;
  selectedId?: string;
  onSelectNode?: (node: TreeNodeData) => void;
  level: number;
}) {
  const [isOpen, setIsOpen] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectNode?.(node)}
        className={`flex items-center gap-2 py-2 pr-3 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
          isSelected
            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className="p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
          >
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {hasChildren ? (
          <Folder className="w-4 h-4 text-indigo-500 shrink-0" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}

        <span className="truncate flex-1">{node.label}</span>

        {node.subLabel && <span className="text-[10px] text-slate-400">{node.subLabel}</span>}

        {node.progressPercent !== undefined && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${node.progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-500 font-medium">{node.progressPercent}%</span>
          </div>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="mt-0.5">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelectNode={onSelectNode}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
