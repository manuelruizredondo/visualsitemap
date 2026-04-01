"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Annotation, AnnotationType, PageMeta, SeoData, A11yData, Tag } from "@/types";
import TagSelector from "./TagSelector";
import DrawingCanvas from "./DrawingCanvas";
import { Button } from "@/components/ui/Button";

interface NodeDrawerProps {
  projectId: string;
  nodeKey: string;
  url: string;
  label: string;
  fullPath: string;
  screenshotUrl?: string;
  customImageUrl?: string;
  pageMeta?: PageMeta;
  annotations: Annotation[];
  visible: boolean;
  onClose: () => void;
  onAnnotationsChange: (key: string, annotations: Annotation[]) => void;
  onCustomImageChange: (key: string, customImageUrl: string) => void;
  availableTags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (pageKey: string, tagIds: string[]) => void;
  onTagCreated: (tag: Tag) => void;
  onTagDeleted: (tagId: string) => void;
  customName?: string;
  onNameChange: (pageKey: string, name: string) => void;
  savedDrawing?: string;
  onDrawingSave: (pageKey: string, drawingData: string | null) => void;
  onRecapture: (pageKey: string, url: string) => Promise<void>;
}

const TYPE_CONFIG: Record<AnnotationType, { label: string; color: string; bg: string; dot: string }> = {
  error: { label: "Error", color: "text-red-600", bg: "bg-red-50/60", dot: "bg-red-500" },
  mejora: { label: "Mejora", color: "text-amber-600", bg: "bg-amber-50/60", dot: "bg-amber-500" },
  nota: { label: "Nota", color: "text-[#5a3bdd]", bg: "bg-[#5a3bdd]/5", dot: "bg-[#5a3bdd]" },
};

function calculateSeoScore(seo: SeoData): number {
  let score = 0;
  if (seo.titleLength >= 30 && seo.titleLength <= 60) score++;
  if (seo.descriptionLength >= 120 && seo.descriptionLength <= 160) score++;
  if (seo.h1.length > 0) score++;
  if (seo.h1.length === 1) score++;
  if (seo.hasOgTitle) score++;
  if (seo.hasOgDescription) score++;
  if (seo.hasOgImage) score++;
  if (seo.hasCanonical) score++;
  if (seo.totalImages === 0 || seo.imgWithoutAlt === 0) score++;
  if (seo.wordCount > 300) score++;
  return score;
}

function calculateA11yScore(a11y: A11yData): number {
  let score = 10;
  if (a11y.totalImages > 0 && a11y.imgWithoutAlt > 0) score--;
  if (a11y.buttonsWithoutLabel > 0) score--;
  if (a11y.inputsWithoutLabel > 0) score--;
  if (a11y.linksWithoutText > 0) score--;
  if (a11y.missingLang) score--;
  if (!a11y.headingOrderValid) score--;
  if (a11y.lowContrastTexts >= 3) score--;
  if (a11y.missingSkipLink) score--;
  if (a11y.missingMainLandmark) score--;
  if (a11y.autoplaying > 0) score--;
  return Math.max(0, score);
}

/* ── Reusable score badge ────────────────────────────────────────────── */
function ScoreBadge({ score, max, label }: { score: number; max: number; label: string }) {
  const pct = score / max;
  const color = pct >= 0.8 ? "#34d399" : pct >= 0.5 ? "#fbbf24" : "#f87171";
  return (
    <div className="flex items-center gap-3">
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 16,
        background: `conic-gradient(${color} ${pct * 360}deg, var(--ec-surface-container-low) 0deg)`,
        color: "var(--ec-on-surface)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: "var(--ec-surface-container-lowest)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {score}/{max}
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ec-on-surface)" }}>{label}</p>
        <p style={{ fontSize: 12, color: "var(--ec-on-surface-variant)", marginTop: 2 }}>
          {pct >= 0.8 ? "Excelente" : pct >= 0.5 ? "Mejorable" : "Requiere atención"}
        </p>
      </div>
    </div>
  );
}

/* ── Reusable info card ──────────────────────────────────────────────── */
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 16, padding: "14px 16px",
      background: "var(--ec-surface-container-low)",
    }}>
      <h4 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ec-on-surface-variant)", marginBottom: 10 }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

/* ── Check row ───────────────────────────────────────────────────────── */
function CheckRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, padding: "3px 0" }}>
      <span style={{ color: "var(--ec-on-surface-variant)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: ok ? "#34d399" : "#f87171" }}>
        {detail || (ok ? "✓" : "✗")}
      </span>
    </div>
  );
}

export default function NodeDrawer({
  projectId, nodeKey, url, label, fullPath, screenshotUrl, customImageUrl,
  pageMeta, annotations, visible, onClose, onAnnotationsChange, onCustomImageChange,
  availableTags, selectedTagIds, onTagsChange, onTagCreated, onTagDeleted,
  customName, onNameChange, savedDrawing, onDrawingSave, onRecapture,
}: NodeDrawerProps) {
  const [localAnnotations, setLocalAnnotations] = useState<Annotation[]>(annotations);
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<AnnotationType>("nota");
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [localCustomImage, setLocalCustomImage] = useState<string | undefined>(customImageUrl);
  const [imageExpanded, setImageExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "seo" | "a11y">("info");
  const [filterType, setFilterType] = useState<AnnotationType | "all">("all");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [recapturing, setRecapturing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNewText(""); setImgError(false); setImageExpanded(false); setActiveTab("info"); setFilterType("all"); setEditingTitle(false); }, [nodeKey]);
  useEffect(() => { setLocalAnnotations(annotations); }, [annotations]);
  useEffect(() => { setLocalCustomImage(customImageUrl); }, [customImageUrl]);

  const title = customName || pageMeta?.title || label;
  const description = pageMeta?.description || "";
  const displayImage = localCustomImage || screenshotUrl;
  const seo = pageMeta?.seo;
  const seoScore = seo ? calculateSeoScore(seo) : null;
  const a11y = pageMeta?.a11y;
  const a11yScore = a11y ? calculateA11yScore(a11y) : null;

  async function handleAddAnnotation(e: React.FormEvent) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/annotations`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nodeKey, text: newText.trim(), type: newType }),
      });
      const data = await res.json();
      const updated = [...localAnnotations, data.annotation];
      setLocalAnnotations(updated);
      onAnnotationsChange(nodeKey, updated);
      setNewText("");
      textareaRef.current?.focus();
    } finally { setSaving(false); }
  }

  async function handleDelete(annotationId: string) {
    await fetch(`/api/projects/${projectId}/annotations`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: nodeKey, annotationId }),
    });
    const updated = localAnnotations.filter((a) => a.id !== annotationId);
    setLocalAnnotations(updated);
    onAnnotationsChange(nodeKey, updated);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", nodeKey);
      const res = await fetch(`/api/projects/${projectId}/images`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.customImageUrl) { setLocalCustomImage(data.customImageUrl); setImgError(false); onCustomImageChange(nodeKey, data.customImageUrl); }
    } finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleImageDropOnDrawer(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("key", nodeKey);
      const res = await fetch(`/api/projects/${projectId}/images`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.customImageUrl) { setLocalCustomImage(data.customImageUrl); setImgError(false); onCustomImageChange(nodeKey, data.customImageUrl); }
    } finally { setUploadingImage(false); }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  const handleDrawingSave2 = useCallback((dataUrl: string | null) => { onDrawingSave(nodeKey, dataUrl); }, [nodeKey, onDrawingSave]);

  async function handleRecapture() {
    if (!url || recapturing) return;
    setRecapturing(true);
    try { await onRecapture(nodeKey, url); } finally { setRecapturing(false); }
  }

  async function handleSaveTitle() {
    const trimmed = editTitleValue.trim();
    if (trimmed === (customName || pageMeta?.title || label)) { setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      await fetch(`/api/projects/${projectId}/page-name`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey: nodeKey, name: trimmed }),
      });
      onNameChange(nodeKey, trimmed);
      setEditingTitle(false);
    } finally { setSavingTitle(false); }
  }

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: "12px 0", fontSize: 13, fontWeight: 600 as const, cursor: "pointer" as const,
    border: "none", background: "transparent",
    borderBottom: active ? "2px solid var(--ec-secondary)" : "2px solid transparent",
    color: active ? "var(--ec-secondary)" : "var(--ec-on-surface-variant)",
    transition: "all 0.15s",
  });

  return (
    <div
      className={`absolute right-0 top-0 z-50 h-full flex ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}
      style={{ transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease" }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Expanded image panel */}
      {displayImage && !imgError && (
        <div className={`h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${imageExpanded ? "w-[520px]" : "w-0"}`}
          style={{ background: "var(--ec-surface-container-lowest)", borderLeft: imageExpanded ? "1px solid var(--ec-surface-container-high)" : "none" }}
        >
          <div className="min-w-[520px] flex flex-col h-full">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid var(--ec-surface-container-high)", background: "var(--ec-surface-container-lowest)" }}>
              <span style={{ fontSize: 13, color: "var(--ec-on-surface)", fontWeight: 600 }}>{title}</span>
              <button onClick={() => setImageExpanded(false)}
                style={{ width: 30, height: 30, borderRadius: 10, border: "none", background: "var(--ec-surface-container-low)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ec-on-surface-variant)", transition: "background 0.15s" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <DrawingCanvas imageUrl={displayImage} savedDrawing={savedDrawing} onSave={handleDrawingSave2} />
          </div>
        </div>
      )}

      {/* Main drawer */}
      <div style={{
        width: 400, height: "100%", display: "flex", flexDirection: "column",
        background: "var(--ec-surface-container-lowest)",
        boxShadow: "-8px 0 32px rgba(26,28,30,0.08)",
        borderLeft: "1px solid var(--ec-surface-container-high)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--ec-surface-container-high)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--ec-secondary)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ec-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          </div>
          <button onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 12, border: "none", background: "var(--ec-surface-container-low)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ec-on-surface-variant)", flexShrink: 0, marginLeft: 8, transition: "background 0.15s" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--ec-surface-container-high)", padding: "0 20px", flexShrink: 0 }}>
          <button onClick={() => setActiveTab("info")} style={tabStyle(activeTab === "info")}>Info</button>
          <button onClick={() => setActiveTab("seo")} style={tabStyle(activeTab === "seo")}>SEO</button>
          <button onClick={() => setActiveTab("a11y")} style={tabStyle(activeTab === "a11y")}>A11y</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {activeTab === "info" && (
            <>
              {/* Screenshot */}
              <div
                style={{ position: "relative", background: dragOver ? "var(--ec-primary-container)" : "var(--ec-surface-container-low)", borderBottom: "1px solid var(--ec-surface-container-high)", transition: "background 0.15s" }}
                className="group"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                onDragLeave={(e) => { e.stopPropagation(); setDragOver(false); }}
                onDrop={handleImageDropOnDrawer}
              >
                {dragOver && (
                  <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(90,59,221,0.12)", pointerEvents: "none" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--ec-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ec-primary)" }}>Suelta para cambiar imagen</span>
                  </div>
                )}
                {displayImage && !imgError ? (
                  <img src={displayImage} alt={title}
                    style={{ width: "100%", display: "block", cursor: "zoom-in" }}
                    onError={() => setImgError(true)}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setImageExpanded(true); }}
                  />
                ) : (
                  <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ec-surface-container-high)" }}>
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                )}
                <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {url && (
                    <button onClick={handleRecapture} disabled={recapturing}
                      style={{ padding: "6px 10px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", color: "#fff" }}
                    >
                      {recapturing ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Capturando...</> : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>Recapturar</>}
                    </button>
                  )}
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}
                    style={{ padding: "6px 10px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: "rgba(0,0,0,0.6)", color: "#fff" }}
                  >
                    {uploadingImage ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />Subiendo...</> : <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Cambiar imagen</>}
                  </button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              {/* Page info */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--ec-surface-container-high)" }}>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12, color: "var(--ec-secondary)", wordBreak: "break-all", display: "block", marginBottom: 8, textDecoration: "none" }}
                  >{url} ↗</a>
                )}
                {editingTitle ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="text" value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onBlur={handleSaveTitle}
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false); }}
                      disabled={savingTitle} autoFocus
                      style={{ flex: 1, padding: "6px 12px", fontSize: 15, fontWeight: 700, color: "var(--ec-on-surface)", border: "none", borderRadius: 12, background: "var(--ec-surface-container-low)", outline: "none", boxShadow: "0 0 0 2px rgba(90,59,221,0.25)" }}
                    />
                    {savingTitle && <div className="w-4 h-4 border-2 border-[#5a3bdd] border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ec-on-surface)", flex: 1 }}>{title}</p>
                    <button onClick={() => { setEditTitleValue(title); setEditingTitle(true); }}
                      className="opacity-0 group-hover/title:opacity-100 transition-opacity"
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ec-on-surface-variant)", flexShrink: 0 }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                  </div>
                )}
                {description ? (
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant)", marginTop: 4, lineHeight: 1.5 }}>{description}</p>
                ) : (
                  <p style={{ fontSize: 12, color: "var(--ec-surface-container-high)", marginTop: 4, fontStyle: "italic" }}>Sin descripción meta</p>
                )}
                <p style={{ fontSize: 11, color: "var(--ec-on-surface-variant)", marginTop: 8, fontFamily: "monospace" }}>{fullPath}</p>
                <div style={{ marginTop: 12 }}>
                  <TagSelector projectId={projectId} pageKey={nodeKey} availableTags={availableTags} selectedTagIds={selectedTagIds} onTagsChange={onTagsChange} onTagCreated={onTagCreated} onTagDeleted={onTagDeleted} />
                </div>
              </div>

              {/* Annotations */}
              <div style={{ padding: "16px 20px" }}>
                <h3 style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ec-on-surface-variant)", marginBottom: 12 }}>
                  Anotaciones ({localAnnotations.length})
                </h3>

                {localAnnotations.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                    <button onClick={() => setFilterType("all")}
                      style={{ padding: "5px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: filterType === "all" ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: filterType === "all" ? "#fff" : "var(--ec-on-surface-variant)", transition: "all 0.15s" }}
                    >Todos ({localAnnotations.length})</button>
                    {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map((type) => {
                      const count = localAnnotations.filter((a) => a.type === type).length;
                      const cfg = TYPE_CONFIG[type];
                      return (
                        <button key={type} onClick={() => setFilterType(type)}
                          style={{ padding: "5px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: filterType === type ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: filterType === type ? "#fff" : "var(--ec-on-surface-variant)", transition: "all 0.15s" }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}

                {localAnnotations.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant)", textAlign: "center", padding: "24px 0", fontStyle: "italic" }}>
                    Sin anotaciones. Añade la primera abajo.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {localAnnotations.filter((ann) => filterType === "all" || ann.type === filterType).map((ann) => {
                      const cfg = TYPE_CONFIG[ann.type];
                      return (
                        <div key={ann.id} className="group"
                          style={{ borderRadius: 14, padding: "10px 14px", background: "var(--ec-surface-container-low)" }}
                        >
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                              <span className={cfg.color} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, flexShrink: 0, marginTop: 2 }}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              <p style={{ fontSize: 13, color: "var(--ec-on-surface)", lineHeight: 1.5 }}>{ann.text}</p>
                            </div>
                            <button onClick={() => handleDelete(ann.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ec-on-surface-variant)", flexShrink: 0, marginTop: 2, padding: 0 }}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                          <p style={{ fontSize: 10, color: "var(--ec-on-surface-variant)", marginTop: 6 }}>{formatDate(ann.createdAt)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "seo" && (
            <>
              {seo ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <ScoreBadge score={seoScore!} max={10} label="Puntuación SEO" />

                  <InfoCard title="Título">
                    <CheckRow label={`${seo.titleLength} caracteres`} ok={seo.titleLength >= 30 && seo.titleLength <= 60} detail={seo.titleLength >= 30 && seo.titleLength <= 60 ? "✓ Correcto" : "✗ 30-60 chars"} />
                    {title && <p style={{ fontSize: 12, color: "var(--ec-on-surface-variant)", background: "var(--ec-surface-container)", padding: "8px 10px", borderRadius: 10, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={title}>{title}</p>}
                  </InfoCard>

                  <InfoCard title="Descripción">
                    <CheckRow label={`${seo.descriptionLength} caracteres`} ok={seo.descriptionLength >= 120 && seo.descriptionLength <= 160} detail={seo.descriptionLength >= 120 && seo.descriptionLength <= 160 ? "✓ Correcto" : "✗ 120-160 chars"} />
                    {description && <p style={{ fontSize: 12, color: "var(--ec-on-surface-variant)", background: "var(--ec-surface-container)", padding: "8px 10px", borderRadius: 10, marginTop: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={description}>{description}</p>}
                  </InfoCard>

                  <InfoCard title="Estructura de Encabezados">
                    <CheckRow label="H1" ok={seo.h1.length === 1} detail={`${seo.h1.length} ${seo.h1.length === 1 ? "(óptimo)" : "(requiere 1)"}`} />
                    {seo.h1.length > 0 && (
                      <div style={{ fontSize: 12, color: "var(--ec-on-surface-variant)", background: "var(--ec-surface-container)", padding: "8px 10px", borderRadius: 10, marginTop: 6 }}>
                        {seo.h1.map((h, i) => <div key={i} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h}>→ {h || "(vacío)"}</div>)}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ec-on-surface-variant)", marginTop: 8 }}>
                      <span>H2: {seo.h2Count}</span><span>H3: {seo.h3Count}</span>
                    </div>
                  </InfoCard>

                  <InfoCard title="Etiquetas OG">
                    <CheckRow label="og:title" ok={seo.hasOgTitle} />
                    <CheckRow label="og:description" ok={seo.hasOgDescription} />
                    <CheckRow label="og:image" ok={seo.hasOgImage} />
                  </InfoCard>

                  <InfoCard title="Canonical">
                    <CheckRow label={seo.hasCanonical ? "Presente" : "Ausente"} ok={seo.hasCanonical} />
                    {seo.canonicalUrl && <p style={{ fontSize: 12, color: "var(--ec-on-surface-variant)", background: "var(--ec-surface-container)", padding: "8px 10px", borderRadius: 10, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={seo.canonicalUrl}>{seo.canonicalUrl}</p>}
                  </InfoCard>

                  <InfoCard title="Imágenes">
                    <CheckRow label="Total" ok={true} detail={String(seo.totalImages)} />
                    {seo.totalImages > 0 && <CheckRow label="Sin alt" ok={seo.imgWithoutAlt === 0} detail={String(seo.imgWithoutAlt)} />}
                  </InfoCard>

                  <InfoCard title="Enlaces">
                    <CheckRow label="Internos" ok={true} detail={String(seo.internalLinks)} />
                    <CheckRow label="Externos" ok={true} detail={String(seo.externalLinks)} />
                  </InfoCard>

                  <InfoCard title="Contenido">
                    <CheckRow label="Palabras" ok={seo.wordCount > 300} detail={`${seo.wordCount} ${seo.wordCount > 300 ? "✓" : "< 300"}`} />
                  </InfoCard>
                </div>
              ) : (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant)" }}>Sin datos SEO disponibles</p>
                  <p style={{ fontSize: 12, color: "var(--ec-surface-container-high)", marginTop: 8 }}>Ejecuta un análisis para obtener datos SEO</p>
                </div>
              )}
            </>
          )}

          {activeTab === "a11y" && (
            <>
              {a11y ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
                  <ScoreBadge score={a11yScore!} max={10} label="Accesibilidad" />

                  <InfoCard title="Idioma">
                    <CheckRow label="Atributo lang en <html>" ok={!a11y.missingLang} detail={!a11y.missingLang ? "✓" : "✗ Falta"} />
                  </InfoCard>

                  <InfoCard title="Landmarks">
                    <CheckRow label="<main>" ok={!a11y.missingMainLandmark} detail={!a11y.missingMainLandmark ? "✓" : "✗ Falta"} />
                    <CheckRow label="<nav>" ok={!a11y.missingNavLandmark} detail={!a11y.missingNavLandmark ? "✓" : "✗ Falta"} />
                    <CheckRow label="Skip link" ok={!a11y.missingSkipLink} detail={!a11y.missingSkipLink ? "✓" : "✗ Falta"} />
                  </InfoCard>

                  <InfoCard title="Jerarquía de Encabezados">
                    <CheckRow label="Orden correcto" ok={a11y.headingOrderValid} detail={a11y.headingOrderValid ? "✓" : "✗ Saltos en la jerarquía"} />
                    {a11y.headingSequence.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, background: "var(--ec-surface-container)", padding: "8px 10px", borderRadius: 10 }}>
                        {a11y.headingSequence.map((level, i) => (
                          <span key={i} style={{ padding: "2px 6px", borderRadius: 6, fontSize: 10, fontFamily: "monospace", background: i > 0 && level > a11y.headingSequence[i - 1] + 1 ? "rgba(248,113,113,0.15)" : "var(--ec-surface-container-low)", color: i > 0 && level > a11y.headingSequence[i - 1] + 1 ? "#f87171" : "var(--ec-on-surface-variant)" }}>
                            H{level}
                          </span>
                        ))}
                      </div>
                    )}
                  </InfoCard>

                  <InfoCard title="Imágenes">
                    <CheckRow label="Total" ok={true} detail={String(a11y.totalImages)} />
                    {a11y.totalImages > 0 && <CheckRow label="Sin atributo alt" ok={a11y.imgWithoutAlt === 0} detail={a11y.imgWithoutAlt === 0 ? "✓ Ninguna" : `✗ ${a11y.imgWithoutAlt}`} />}
                  </InfoCard>

                  <InfoCard title="Elementos Interactivos">
                    {a11y.totalButtons > 0 && <CheckRow label="Botones sin label" ok={a11y.buttonsWithoutLabel === 0} detail={a11y.buttonsWithoutLabel === 0 ? "✓" : `✗ ${a11y.buttonsWithoutLabel}/${a11y.totalButtons}`} />}
                    {a11y.totalInputs > 0 && <CheckRow label="Inputs sin label" ok={a11y.inputsWithoutLabel === 0} detail={a11y.inputsWithoutLabel === 0 ? "✓" : `✗ ${a11y.inputsWithoutLabel}/${a11y.totalInputs}`} />}
                    {a11y.totalLinks > 0 && <CheckRow label="Enlaces sin texto" ok={a11y.linksWithoutText === 0} detail={a11y.linksWithoutText === 0 ? "✓" : `✗ ${a11y.linksWithoutText}/${a11y.totalLinks}`} />}
                  </InfoCard>

                  <InfoCard title="Contraste">
                    <CheckRow label="Textos con bajo contraste" ok={a11y.lowContrastTexts === 0} detail={a11y.lowContrastTexts === 0 ? "✓ Ninguno" : `~${a11y.lowContrastTexts}`} />
                  </InfoCard>

                  {a11y.autoplaying > 0 && (
                    <InfoCard title="Media">
                      <CheckRow label="Autoplay detectado" ok={false} detail={`✗ ${a11y.autoplaying}`} />
                    </InfoCard>
                  )}

                  {a11y.totalFormFields > 0 && (
                    <InfoCard title="Formularios">
                      <CheckRow label="Campos sin autocomplete" ok={a11y.formFieldsWithoutAutocomplete === 0} detail={a11y.formFieldsWithoutAutocomplete === 0 ? "✓" : `${a11y.formFieldsWithoutAutocomplete}/${a11y.totalFormFields}`} />
                    </InfoCard>
                  )}
                </div>
              ) : (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant)" }}>Sin datos de accesibilidad</p>
                  <p style={{ fontSize: 12, color: "var(--ec-surface-container-high)", marginTop: 8 }}>Ejecuta un análisis para obtener datos</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* New annotation form */}
        <div style={{ borderTop: "1px solid var(--ec-surface-container-high)", padding: "16px 20px", flexShrink: 0, background: "var(--ec-surface-container-low)" }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ec-on-surface-variant)", marginBottom: 10 }}>
            Nueva anotación
          </p>
          <form onSubmit={handleAddAnnotation} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map((t) => {
                const cfg = TYPE_CONFIG[t];
                const active = newType === t;
                return (
                  <button key={t} type="button" onClick={() => setNewType(t)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 9999, fontSize: 12, fontWeight: 600,
                      border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      background: active ? "var(--ec-secondary)" : "var(--ec-surface-container-lowest)",
                      color: active ? "#fff" : "var(--ec-on-surface-variant)",
                      transition: "all 0.15s",
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : cfg.dot}`} />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <textarea ref={textareaRef} value={newText} onChange={(e) => setNewText(e.target.value)}
              placeholder="Escribe tu anotación..." rows={3}
              style={{ width: "100%", padding: "10px 14px", fontSize: 13, borderRadius: 14, border: "none", resize: "none", background: "var(--ec-surface-container-lowest)", color: "var(--ec-on-surface)", outline: "none", fontFamily: "inherit" }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAddAnnotation(e as unknown as React.FormEvent); }}
            />
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={saving}
              disabled={saving || !newText.trim()}
            >
              {saving ? "Guardando..." : "Guardar anotación"}
            </Button>
            <p style={{ fontSize: 11, color: "var(--ec-on-surface-variant)", textAlign: "center" }}>⌘+Enter para guardar rápido</p>
          </form>
        </div>
      </div>
    </div>
  );
}
