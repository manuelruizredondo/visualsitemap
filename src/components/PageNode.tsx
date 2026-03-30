"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { PageNodeData } from "@/lib/tree-to-flow";

declare global {
  interface Window { __VS_PROJECT_ID__?: string; }
}

function PageNodeComponent({ data }: { data: PageNodeData }) {
  const { label, url, fullPath, screenshotUrl, customImageUrl, title, depth, isVirtual, hasError, seoScore, nodeId, onNameChange } = data;
  const displayImage = customImageUrl || screenshotUrl;
  const displayTitle = title || label;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync displayTitle when data changes externally
  useEffect(() => {
    if (!editing) {
      setEditValue(displayTitle);
    }
  }, [displayTitle, editing]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();
    if (trimmed === displayTitle || !onNameChange) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const pageKey = data.isCustom ? nodeId : url;
      await fetch(`/api/projects/${window.__VS_PROJECT_ID__}/page-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, name: trimmed }),
      });
      onNameChange(pageKey, trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editValue, displayTitle, onNameChange, nodeId, url, data.isCustom]);

  const getSeoColor = (score: number) => {
    if (score >= 8) return "bg-green-500";
    if (score >= 5) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div
      className={`
        rounded-xl shadow-lg border-2 overflow-hidden bg-white
        transition-all duration-200
        ${depth === 0 ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200"}
        ${isVirtual ? "border-dashed border-gray-300 opacity-75" : ""}
        ${hasError ? "border-red-400 bg-red-50" : ""}
        hover:shadow-xl hover:border-blue-400 cursor-pointer
      `}
      style={{ width: 220 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />

      {/* Page title - prominent at top, double-click to edit */}
      <div className="px-3 py-2.5 border-b border-gray-100 bg-white">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") {
                setEditValue(displayTitle);
                setEditing(false);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={saving}
            className="w-full text-sm font-bold text-gray-800 text-center leading-tight bg-blue-50 border border-blue-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        ) : (
          <p
            className="text-sm font-bold text-gray-800 text-center leading-tight line-clamp-2 capitalize hover:text-blue-600 transition-colors"
            onDoubleClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditValue(displayTitle);
              setEditing(true);
            }}
            title="Doble clic para editar nombre"
          >
            {displayTitle}
          </p>
        )}
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="px-2 py-1 flex flex-wrap gap-1 border-b border-gray-100">
          {data.tags.slice(0, 3).map((tag) => {
            const hex = tag.color.replace("#", "");
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            const textColor = brightness > 128 ? "#1f2937" : "#ffffff";
            return (
              <span
                key={tag.id}
                className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                style={{ backgroundColor: tag.color, color: textColor }}
              >
                {tag.name}
              </span>
            );
          })}
          {data.tags.length > 3 && (
            <span className="text-[9px] text-gray-400">+{data.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Screenshot thumbnail */}
      <div className="h-[110px] bg-gray-50 overflow-hidden relative">
        {displayImage ? (
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        ) : hasError ? (
          <div className="flex items-center justify-center h-full text-red-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-gray-200 rounded" />
              <div className="w-16 h-2 bg-gray-200 rounded" />
            </div>
          </div>
        )}

        {isVirtual && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
            <span className="text-xs text-gray-400 font-medium">Ruta intermedia</span>
          </div>
        )}

        {seoScore !== undefined && (
          <div className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getSeoColor(seoScore)} shadow-md`} title={`SEO: ${seoScore}/10`}>
            {seoScore}
          </div>
        )}
      </div>

      {/* Bottom bar with path and link */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <p className="text-[10px] text-gray-400 truncate flex-1">
          {fullPath}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-500 hover:underline flex-shrink-0 ml-1"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-500 !w-3 !h-3" />
    </div>
  );
}

export default memo(PageNodeComponent);
