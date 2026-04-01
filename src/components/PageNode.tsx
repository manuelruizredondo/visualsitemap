"use client";

import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Handle, Position } from "@xyflow/react";
import type { PageNodeData } from "@/lib/tree-to-flow";

declare global {
  interface Window { __VS_PROJECT_ID__?: string; }
}

/* ── Context menu rendered inside each node ─────────────────────────── */
function NodeContextMenu({
  depth, nodeId, url, isCustom,
  availableTags, selectedTagIds,
  onDelete, onToggleTag, onClose,
}: {
  depth: number;
  nodeId: string; url: string; isCustom?: boolean;
  availableTags: { id: string; name: string; color: string }[];
  selectedTagIds: string[];
  onDelete?: (nodeId: string) => void;
  onToggleTag?: (pageKey: string, tagId: string, selected: boolean) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const pageKey = isCustom ? nodeId : url;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay to avoid the same right-click event closing the menu
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 9999,
        minWidth: 180,
        background: "var(--ec-surface-container-lowest)",
        borderRadius: 14,
        boxShadow: "0 8px 32px rgba(26,28,30,0.18), 0 2px 8px rgba(26,28,30,0.08)",
        border: "1px solid var(--ec-surface-container-high)",
        padding: "6px 0",
        fontFamily: "inherit",
      }}
    >
      {/* Tags section */}
      {availableTags.length > 0 && (
        <>
          <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: "var(--ec-on-surface-variant)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Etiquetas
          </div>
          {availableTags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTag?.(pageKey, tag.id, !isSelected);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 14px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--ec-on-surface)",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span style={{
                  width: 14, height: 14, borderRadius: 4,
                  backgroundColor: tag.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,5 4.5,7.5 8,3" />
                    </svg>
                  )}
                </span>
                <span style={{ flex: 1 }}>{tag.name}</span>
              </button>
            );
          })}
          {depth > 0 && onDelete && (
            <div style={{ height: 1, background: "var(--ec-surface-container-high)", margin: "4px 0" }} />
          )}
        </>
      )}

      {/* Delete option */}
      {depth > 0 && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(nodeId);
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 14px",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 13,
            color: "#ef4444",
            textAlign: "left",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.08)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Eliminar
        </button>
      )}
    </div>
  );
}

/* ── Main node component ────────────────────────────────────────────── */
function PageNodeComponent({ data }: { data: PageNodeData }) {
  const { label, url, fullPath, screenshotUrl, thumbnailUrl, customImageUrl, title, depth, isVirtual, isLanguage, hasError, isCapturing, seoScore, a11yScore, nodeId, onNameChange, onDelete, onToggleTag, pageState, onStateChange } = data;
  // Card shows thumbnail (viewport-only, 400px) if available; falls back to full screenshot
  const displayImage = customImageUrl || thumbnailUrl || screenshotUrl;
  const displayTitle = title || label;

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayTitle);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drag & drop state for image
  const [dragOver, setDragOver] = useState(false);
  const [uploadingDrop, setUploadingDrop] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState(false);

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

  // Bracket children reciben la conexión por la izquierda.
  // Un hijo es bracket si su padre es vertical: parent.depth >= verticalFromDepth
  // Como child.depth = parent.depth + 1 → child.depth >= verticalFromDepth + 1
  const vfd = (data.verticalFromDepth ?? 2);
  const isBracketChild = depth >= vfd + 1;
  const targetPos = isBracketChild ? Position.Left : Position.Top;

  const handleImageDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const projectId = window.__VS_PROJECT_ID__;
    if (!projectId) return;
    setUploadingDrop(true);
    try {
      const pageKey = data.isCustom ? nodeId : url;
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", pageKey);
      const res = await fetch(`/api/projects/${projectId}/images`, { method: "POST", body: formData });
      const result = await res.json();
      if (result.customImageUrl) {
        data.onCustomImageChange?.(pageKey, result.customImageUrl);
      }
    } finally {
      setUploadingDrop(false);
    }
  }, [data, nodeId, url]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu(true);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(false);
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500";
    if (score >= 5) return "bg-amber-500";
    return "bg-red-500";
  };

  const availableTags = (data.availableTags ?? []) as { id: string; name: string; color: string }[];
  const selectedTagIds = (data.selectedTagIds ?? []) as string[];

  // ── Language nodes: prominent branch label ─────────────────────────
  if (isLanguage) {
    return (
      <div className="flex flex-col items-center" style={{ width: 160, position: "relative" }}
        onContextMenu={handleContextMenu}
      >
        <Handle id="target-top" type="target" position={Position.Top} style={{
          background: '#5a3bdd', width: 10, height: 10, border: 'none',
          ...(!isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
        }} />
        <Handle id="target-left" type="target" position={Position.Left} className="vs-handle" style={{
          background: '#5a3bdd', width: 10, height: 10, border: 'none',
          ...(isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
        }} />
        <div className="flex items-center gap-2" style={{ background: '#5a3bdd', color: '#fff', padding: '8px 18px', borderRadius: 9999, boxShadow: 'var(--ec-shadow-ambient)' }}>
          <span className="text-sm">🌐</span>
          <span className="text-xs font-bold uppercase tracking-wider">{displayTitle}</span>
        </div>
        <span style={{ fontSize: 9, color: 'var(--ec-on-surface-variant)', marginTop: 4 }}>{fullPath}</span>
        <Handle type="source" position={Position.Bottom} style={{ background: '#5a3bdd', width: 10, height: 10, border: 'none' }} />
        {contextMenu && (
          <NodeContextMenu
            depth={depth} nodeId={nodeId} url={url} isCustom={data.isCustom}
            availableTags={availableTags} selectedTagIds={selectedTagIds}
            onDelete={onDelete} onToggleTag={onToggleTag}
            onClose={closeContextMenu}
          />
        )}
      </div>
    );
  }

  // ── Virtual nodes: simple text label, no card ──────────────────────
  if (isVirtual) {
    return (
      <div className="flex flex-col items-center" style={{ width: 140, position: "relative" }}
        onContextMenu={handleContextMenu}
      >
        <Handle id="target-top" type="target" position={Position.Top} style={{
          background: 'var(--ec-surface-container-high)', width: 8, height: 8, border: 'none',
          ...(!isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
        }} />
        <Handle id="target-left" type="target" position={Position.Left} className="vs-handle" style={{
          background: 'var(--ec-surface-container-high)', width: 8, height: 8, border: 'none',
          ...(isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ec-on-surface)', textAlign: 'center', lineHeight: 1.3, textTransform: 'capitalize' }}>
          {displayTitle}
        </span>
        <span style={{ fontSize: 9, color: 'var(--ec-on-surface-variant)', marginTop: 2 }}>{fullPath}</span>
        <Handle type="source" position={Position.Bottom} style={{ background: 'var(--ec-surface-container-high)', width: 8, height: 8, border: 'none' }} />
        {contextMenu && (
          <NodeContextMenu
            depth={depth} nodeId={nodeId} url={url} isCustom={data.isCustom}
            availableTags={availableTags} selectedTagIds={selectedTagIds}
            onDelete={onDelete} onToggleTag={onToggleTag}
            onClose={closeContextMenu}
          />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: 220,
        borderRadius: 20,
        overflow: 'visible',
        background: 'var(--ec-surface-container-lowest)',
        boxShadow: depth === 0 ? 'var(--ec-shadow-elevated), 0 0 0 2px var(--ec-primary-container)' : 'var(--ec-shadow-ambient)',
        transition: 'box-shadow 0.2s, transform 0.2s',
        cursor: 'pointer',
        border: hasError ? '2px solid var(--ec-error)' : pageState ? `2px solid ${({ borrador: '#9ca3af', revision: '#f59e0b', aprobado: '#22c55e', cambios: '#ef4444' }[pageState] ?? 'transparent')}` : 'none',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--ec-shadow-floating)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = depth === 0 ? 'var(--ec-shadow-elevated), 0 0 0 2px var(--ec-primary-container)' : 'var(--ec-shadow-ambient)';
      }}
      onContextMenu={handleContextMenu}
    >
      <Handle id="target-top" type="target" position={Position.Top} style={{
        background: 'var(--ec-primary-container)', width: 10, height: 10, border: 'none',
        ...(!isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
      }} />
      <Handle id="target-left" type="target" position={Position.Left} className="vs-handle" style={{
        background: 'var(--ec-primary-container)', width: 10, height: 10, border: 'none',
        ...(isBracketChild ? {} : { opacity: 0, pointerEvents: 'none' as const }),
      }} />

      <div style={{ borderRadius: 20, overflow: 'hidden' }}>
      {/* Page title */}
      <div style={{ padding: '12px 14px 10px', background: 'var(--ec-surface-container-lowest)' }}>
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
            style={{
              width: '100%', fontSize: 13, fontWeight: 700, color: 'var(--ec-on-surface)',
              textAlign: 'center', lineHeight: 1.3, background: 'var(--ec-surface-container-low)',
              border: 'none', borderRadius: 9999, padding: '4px 10px',
              outline: 'none', boxShadow: '0 0 0 2px rgba(226,241,98,0.3)',
            }}
          />
        ) : (
          <p
            style={{ fontSize: 13, fontWeight: 700, color: 'var(--ec-on-surface)', textAlign: 'center', lineHeight: 1.3, textTransform: 'capitalize', WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
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
        <div style={{ padding: '4px 10px 6px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                style={{ fontSize: 9, padding: '2px 8px', borderRadius: 9999, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', backgroundColor: tag.color, color: textColor }}
              >
                {tag.name}
              </span>
            );
          })}
          {data.tags.length > 3 && (
            <span style={{ fontSize: 9, color: 'var(--ec-on-surface-variant)' }}>+{data.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Status badge */}
      {pageState && (() => {
        const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
          borrador:  { label: "Borrador",    color: "#9ca3af" },
          revision:  { label: "En revisión", color: "#f59e0b" },
          aprobado:  { label: "Aprobado",    color: "#22c55e" },
          cambios:   { label: "Requiere cambios", color: "#ef4444" },
        };
        const cfg = STATUS_CONFIG[pageState];
        if (!cfg) return null;
        return (
          <div style={{ padding: '3px 10px 5px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cfg.label}</span>
          </div>
        );
      })()}

      {/* Screenshot thumbnail */}
      <div
        style={{ height: 110, background: dragOver ? 'var(--ec-primary-container)' : 'var(--ec-surface-container-low)', overflow: 'hidden', position: 'relative', transition: 'background 0.15s' }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
        onDragLeave={(e) => { e.stopPropagation(); setDragOver(false); }}
        onDrop={handleImageDrop}
      >
        {dragOver && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(90,59,221,0.15)', pointerEvents: 'none' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ec-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
        )}
        {uploadingDrop && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
            <div style={{ width: 20, height: 20, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          </div>
        )}
        {displayImage ? (
          <img
            src={displayImage}
            alt={displayTitle}
            className="w-full h-full object-cover object-top"
            loading="lazy"
          />
        ) : hasError ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--ec-error)' }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.27 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="animate-pulse flex flex-col items-center gap-2">
              <div style={{ width: 40, height: 40, background: 'var(--ec-surface-container)', borderRadius: 12 }} />
              <div style={{ width: 64, height: 6, background: 'var(--ec-surface-container)', borderRadius: 9999 }} />
            </div>
          </div>
        )}

        {/* Capturing overlay */}
        {isCapturing && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}>
            <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {(seoScore !== undefined || a11yScore !== undefined) && (
          <div className="absolute bottom-1.5 right-1.5 flex gap-1">
            {seoScore !== undefined && (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getScoreColor(seoScore)}`} style={{ boxShadow: 'var(--ec-shadow-ambient)' }} title={`SEO: ${seoScore}/10`}>
                {seoScore}
              </div>
            )}
            {a11yScore !== undefined && (
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${getScoreColor(a11yScore)}`} style={{ boxShadow: 'var(--ec-shadow-ambient)' }} title={`A11y: ${a11yScore}/10`}>
                {a11yScore}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar with path and link */}
      <div style={{ padding: '6px 14px', background: 'var(--ec-surface-container-low)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 10, color: 'var(--ec-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {fullPath}
        </p>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 10, color: 'var(--ec-secondary)', flexShrink: 0, marginLeft: 4 }}
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </div>
      </div>{/* close inner clip wrapper */}

      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--ec-primary-container)', width: 10, height: 10, border: 'none' }} />

      {contextMenu && (
        <NodeContextMenu
          depth={depth} nodeId={nodeId} url={url} isCustom={data.isCustom}
          availableTags={availableTags} selectedTagIds={selectedTagIds}
          onDelete={onDelete} onToggleTag={onToggleTag}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}

export default memo(PageNodeComponent);
