"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Annotation, AnnotationType, PageMeta, SeoData, A11yData, Tag } from "@/types";
import TagSelector from "./TagSelector";
import DrawingCanvas from "./DrawingCanvas";

interface NodeDrawerProps {
  projectId: string;
  nodeKey: string; // url for sitemap nodes, nodeId for custom nodes
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
  error: {
    label: "Error",
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
  },
  mejora: {
    label: "Mejora",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
  nota: {
    label: "Nota",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
};

function calculateSeoScore(seo: SeoData): number {
  let score = 0;

  // Title check (30-60 chars)
  if (seo.titleLength >= 30 && seo.titleLength <= 60) score++;

  // Description check (120-160 chars)
  if (seo.descriptionLength >= 120 && seo.descriptionLength <= 160) score++;

  // Has at least one H1
  if (seo.h1.length > 0) score++;

  // Has exactly one H1
  if (seo.h1.length === 1) score++;

  // Has OG title
  if (seo.hasOgTitle) score++;

  // Has OG description
  if (seo.hasOgDescription) score++;

  // Has OG image
  if (seo.hasOgImage) score++;

  // Has canonical
  if (seo.hasCanonical) score++;

  // No images without alt (or no images at all)
  if (seo.totalImages === 0 || seo.imgWithoutAlt === 0) score++;

  // Word count > 300
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

export default function NodeDrawer({
  projectId,
  nodeKey,
  url,
  label,
  fullPath,
  screenshotUrl,
  customImageUrl,
  pageMeta,
  annotations,
  visible,
  onClose,
  onAnnotationsChange,
  onCustomImageChange,
  availableTags,
  selectedTagIds,
  onTagsChange,
  onTagCreated,
  onTagDeleted,
  customName,
  onNameChange,
  savedDrawing,
  onDrawingSave,
  onRecapture,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset UI state when a different node is selected
  useEffect(() => {
    setNewText("");
    setImgError(false);
    setImageExpanded(false);
    setActiveTab("info");
    setFilterType("all");
    setEditingTitle(false);
  }, [nodeKey]);

  // Sync data when props change (e.g. polling updates)
  useEffect(() => {
    setLocalAnnotations(annotations);
  }, [annotations]);

  useEffect(() => {
    setLocalCustomImage(customImageUrl);
  }, [customImageUrl]);

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nodeKey, text: newText.trim(), type: newType }),
      });
      const data = await res.json();
      const updated = [...localAnnotations, data.annotation];
      setLocalAnnotations(updated);
      onAnnotationsChange(nodeKey, updated);
      setNewText("");
      textareaRef.current?.focus();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(annotationId: string) {
    await fetch(`/api/projects/${projectId}/annotations`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
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

      const res = await fetch(`/api/projects/${projectId}/images`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.customImageUrl) {
        setLocalCustomImage(data.customImageUrl);
        setImgError(false);
        onCustomImageChange(nodeKey, data.customImageUrl);
      }
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const handleDrawingSave = useCallback(
    (dataUrl: string | null) => {
      onDrawingSave(nodeKey, dataUrl);
    },
    [nodeKey, onDrawingSave]
  );

  async function handleRecapture() {
    if (!url || recapturing) return;
    setRecapturing(true);
    try {
      await onRecapture(nodeKey, url);
    } finally {
      setRecapturing(false);
    }
  }

  async function handleSaveTitle() {
    const trimmed = editTitleValue.trim();
    // If same as current custom name or original title, skip
    if (trimmed === (customName || pageMeta?.title || label)) {
      setEditingTitle(false);
      return;
    }
    setSavingTitle(true);
    try {
      await fetch(`/api/projects/${projectId}/page-name`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey: nodeKey, name: trimmed }),
      });
      onNameChange(nodeKey, trimmed);
      setEditingTitle(false);
    } finally {
      setSavingTitle(false);
    }
  }

  return (
    <div
      className={`absolute right-0 top-0 z-50 h-full flex transition-transform duration-300 ease-in-out ${
        visible ? "translate-x-0" : "translate-x-full"
      }`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Expanded image panel — always rendered when image exists, animated via width */}
      {displayImage && !imgError && (
        <div
          className={`h-full bg-gray-900 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
            imageExpanded ? "w-[520px] border-l border-gray-700" : "w-0 border-0"
          }`}
        >
          <div className="min-w-[520px] flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
              <span className="text-sm text-gray-300 font-medium truncate">{title}</span>
              <button
                onClick={() => setImageExpanded(false)}
                className="w-7 h-7 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <DrawingCanvas
              imageUrl={displayImage}
              savedDrawing={savedDrawing}
              onSave={handleDrawingSave}
            />
          </div>
        </div>
      )}

      {/* Main drawer */}
      <div className="w-[400px] h-full bg-white shadow-2xl flex flex-col border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-gray-800 truncate">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 px-5 flex-shrink-0 bg-gray-50">
        <button
          onClick={() => setActiveTab("info")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "info"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Info
        </button>
        <button
          onClick={() => setActiveTab("seo")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "seo"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          SEO
        </button>
        <button
          onClick={() => setActiveTab("a11y")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "a11y"
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          A11y
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "info" && (
          <>
            {/* Screenshot / Custom image */}
            <div className="bg-gray-50 border-b border-gray-100 relative group">
              {displayImage && !imgError ? (
                <img
                  src={displayImage}
                  alt={title}
                  className="w-full object-cover object-top max-h-52 cursor-zoom-in"
                  onError={() => setImgError(true)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setImageExpanded(true);
                  }}
                  title="Ver captura completa"
                />
              ) : (
                <div className="h-36 flex items-center justify-center text-gray-300">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {/* Recapture + Image upload overlay */}
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {url && (
                  <button
                    onClick={handleRecapture}
                    disabled={recapturing}
                    className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50"
                    title="Recapturar página"
                  >
                    {recapturing ? (
                      <>
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        Capturando...
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Recapturar
                      </>
                    )}
                  </button>
                )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {uploadingImage ? (
                  <>
                    <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Cambiar imagen
                  </>
                )}
              </button>
              </div>{/* end button group */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>

            {/* Page info */}
            <div className="px-5 py-4 border-b border-gray-100">
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline break-all block mb-2"
                >
                  {url} ↗
                </a>
              )}
              {editingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitleValue}
                    onChange={(e) => setEditTitleValue(e.target.value)}
                    onBlur={handleSaveTitle}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    disabled={savingTitle}
                    autoFocus
                    className="flex-1 px-2 py-1 text-base font-semibold text-gray-900 border border-blue-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {savingTitle && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />}
                </div>
              ) : (
                <div className="flex items-center gap-2 group/title">
                  <p className="text-base font-semibold text-gray-900 flex-1">{title}</p>
                  <button
                    onClick={() => {
                      setEditTitleValue(title);
                      setEditingTitle(true);
                    }}
                    className="opacity-0 group-hover/title:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 flex-shrink-0"
                    title="Editar nombre"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              )}
              {description ? (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
              ) : (
                <p className="text-xs text-gray-300 mt-1 italic">Sin descripción meta</p>
              )}
              <p className="text-xs text-gray-400 mt-2 font-mono">{fullPath}</p>

              {/* Tags */}
              <div className="mt-3">
                <TagSelector
                  projectId={projectId}
                  pageKey={nodeKey}
                  availableTags={availableTags}
                  selectedTagIds={selectedTagIds}
                  onTagsChange={onTagsChange}
                  onTagCreated={onTagCreated}
                  onTagDeleted={onTagDeleted}
                />
              </div>
            </div>

            {/* Annotations list */}
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                Anotaciones ({localAnnotations.length})
              </h3>

              {localAnnotations.length > 0 && (
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`text-xs px-2 py-1.5 rounded-lg border transition-all font-medium ${
                      filterType === "all"
                        ? "bg-blue-50 text-blue-700 border-blue-200"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Todos ({localAnnotations.length})
                  </button>
                  {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map((type) => {
                    const count = localAnnotations.filter((a) => a.type === type).length;
                    const cfg = TYPE_CONFIG[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setFilterType(type)}
                        className={`text-xs px-2 py-1.5 rounded-lg border transition-all font-medium flex items-center gap-1 ${
                          filterType === type
                            ? `${cfg.bg} ${cfg.color} border-current`
                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {localAnnotations.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-4">
                  Sin anotaciones. Añade la primera abajo.
                </p>
              ) : (
                <ul className="space-y-2 mb-4">
                  {localAnnotations
                    .filter((ann) => filterType === "all" || ann.type === filterType)
                    .map((ann) => {
                      const cfg = TYPE_CONFIG[ann.type];
                      return (
                        <li
                          key={ann.id}
                          className={`rounded-lg border px-3 py-2.5 ${cfg.bg} group`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                              </span>
                              <p className="text-sm text-gray-700 leading-relaxed">{ann.text}</p>
                            </div>
                            <button
                              onClick={() => handleDelete(ann.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100 mt-0.5"
                              title="Eliminar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1.5 ml-0">{formatDate(ann.createdAt)}</p>
                        </li>
                      );
                    })}
                </ul>
              )}
            </div>
          </>
        )}
        {activeTab === "seo" && (
          <>
            {seo ? (
              <div className="px-5 py-4 space-y-5">
                {/* SEO Score */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ${
                      seoScore! >= 8
                        ? "bg-green-100 text-green-700"
                        : seoScore! >= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {seoScore}/10
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">Puntuación SEO</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {seoScore! >= 8 ? "Excelente" : seoScore! >= 5 ? "Mejorable" : "Requiere atención"}
                    </p>
                  </div>
                </div>

                {/* Title Analysis */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Título</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{seo.titleLength} caracteres</span>
                      {seo.titleLength >= 30 && seo.titleLength <= 60 ? (
                        <span className="text-xs font-medium text-green-600">✓ Correcto</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">✗ 30-60 chars</span>
                      )}
                    </div>
                    {title && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded truncate" title={title}>{title}</p>}
                  </div>
                </div>

                {/* Description Analysis */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Descripción</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{seo.descriptionLength} caracteres</span>
                      {seo.descriptionLength >= 120 && seo.descriptionLength <= 160 ? (
                        <span className="text-xs font-medium text-green-600">✓ Correcto</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">✗ 120-160 chars</span>
                      )}
                    </div>
                    {description && <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded line-clamp-2" title={description}>{description}</p>}
                  </div>
                </div>

                {/* Heading Structure */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Estructura de Encabezados</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">H1:</span>
                      <span className={seo.h1.length === 1 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                        {seo.h1.length} {seo.h1.length === 1 ? "(óptimo)" : "(requiere 1)"}
                      </span>
                    </div>
                    {seo.h1.length > 0 && (
                      <div className="text-gray-500 bg-gray-50 p-2 rounded">
                        {seo.h1.map((h, i) => (
                          <div key={i} className="truncate" title={h}>→ {h || "(vacío)"}</div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-gray-600">H2: {seo.h2Count}</span>
                      <span className="text-gray-600">H3: {seo.h3Count}</span>
                    </div>
                  </div>
                </div>

                {/* OG Tags */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Etiquetas OG</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">og:title</span>
                      <span className={seo.hasOgTitle ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {seo.hasOgTitle ? "✓" : "✗"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">og:description</span>
                      <span className={seo.hasOgDescription ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {seo.hasOgDescription ? "✓" : "✗"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">og:image</span>
                      <span className={seo.hasOgImage ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {seo.hasOgImage ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Canonical & Links */}
                <div className="border border-gray-200 rounded-lg p-3 space-y-3">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Canonical</h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{seo.hasCanonical ? "Presente" : "Ausente"}</span>
                      <span className={seo.hasCanonical ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {seo.hasCanonical ? "✓" : "✗"}
                      </span>
                    </div>
                    {seo.canonicalUrl && (
                      <p className="text-xs text-gray-500 bg-gray-50 p-2 rounded mt-1.5 truncate" title={seo.canonicalUrl}>
                        {seo.canonicalUrl}
                      </p>
                    )}
                  </div>
                </div>

                {/* Images */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Imágenes</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="text-gray-700 font-medium">{seo.totalImages}</span>
                    </div>
                    {seo.totalImages > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Sin alt</span>
                        <span className={seo.imgWithoutAlt === 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {seo.imgWithoutAlt}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Links */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Enlaces</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Internos</span>
                      <span className="text-gray-700 font-medium">{seo.internalLinks}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Externos</span>
                      <span className="text-gray-700 font-medium">{seo.externalLinks}</span>
                    </div>
                  </div>
                </div>

                {/* Word Count */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Contenido</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Palabras</span>
                    <span className={seo.wordCount > 300 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                      {seo.wordCount} {seo.wordCount > 300 ? "✓" : "< 300"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-gray-400">Sin datos SEO disponibles</p>
                <p className="text-xs text-gray-300 mt-2">Ejecuta un análisis de captura de pantallas para obtener datos SEO</p>
              </div>
            )}
          </>
        )}
        {activeTab === "a11y" && (
          <>
            {a11y ? (
              <div className="px-5 py-4 space-y-5">
                {/* A11y Score */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg ${
                      a11yScore! >= 8
                        ? "bg-green-100 text-green-700"
                        : a11yScore! >= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {a11yScore}/10
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">Accesibilidad</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {a11yScore! >= 8 ? "Buen nivel" : a11yScore! >= 5 ? "Mejorable" : "Requiere atención"}
                    </p>
                  </div>
                </div>

                {/* Lang attribute */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Idioma</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Atributo lang en &lt;html&gt;</span>
                    <span className={!a11y.missingLang ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {!a11y.missingLang ? "✓" : "✗ Falta"}
                    </span>
                  </div>
                </div>

                {/* Landmarks */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Landmarks</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">&lt;main&gt;</span>
                      <span className={!a11y.missingMainLandmark ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {!a11y.missingMainLandmark ? "✓" : "✗ Falta"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">&lt;nav&gt;</span>
                      <span className={!a11y.missingNavLandmark ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {!a11y.missingNavLandmark ? "✓" : "✗ Falta"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Skip link</span>
                      <span className={!a11y.missingSkipLink ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {!a11y.missingSkipLink ? "✓" : "✗ Falta"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Heading hierarchy */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Jerarquía de Encabezados</h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Orden correcto</span>
                      <span className={a11y.headingOrderValid ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                        {a11y.headingOrderValid ? "✓" : "✗ Saltos en la jerarquía"}
                      </span>
                    </div>
                    {a11y.headingSequence.length > 0 && (
                      <div className="text-gray-500 bg-gray-50 p-2 rounded flex flex-wrap gap-1">
                        {a11y.headingSequence.map((level, i) => (
                          <span
                            key={i}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                              i > 0 && level > a11y.headingSequence[i - 1] + 1
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            H{level}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Images */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Imágenes</h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total</span>
                      <span className="text-gray-700 font-medium">{a11y.totalImages}</span>
                    </div>
                    {a11y.totalImages > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Sin atributo alt</span>
                        <span className={a11y.imgWithoutAlt === 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {a11y.imgWithoutAlt === 0 ? "✓ Ninguna" : `✗ ${a11y.imgWithoutAlt}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive elements */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Elementos Interactivos</h4>
                  <div className="space-y-1.5 text-xs">
                    {a11y.totalButtons > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Botones sin label</span>
                        <span className={a11y.buttonsWithoutLabel === 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {a11y.buttonsWithoutLabel === 0 ? "✓" : `✗ ${a11y.buttonsWithoutLabel}/${a11y.totalButtons}`}
                        </span>
                      </div>
                    )}
                    {a11y.totalInputs > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Inputs sin label</span>
                        <span className={a11y.inputsWithoutLabel === 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {a11y.inputsWithoutLabel === 0 ? "✓" : `✗ ${a11y.inputsWithoutLabel}/${a11y.totalInputs}`}
                        </span>
                      </div>
                    )}
                    {a11y.totalLinks > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Enlaces sin texto</span>
                        <span className={a11y.linksWithoutText === 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                          {a11y.linksWithoutText === 0 ? "✓" : `✗ ${a11y.linksWithoutText}/${a11y.totalLinks}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contrast */}
                <div className="border border-gray-200 rounded-lg p-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Contraste</h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Textos con bajo contraste</span>
                    <span className={a11y.lowContrastTexts === 0 ? "text-green-600 font-medium" : a11y.lowContrastTexts < 3 ? "text-amber-600 font-medium" : "text-red-600 font-medium"}>
                      {a11y.lowContrastTexts === 0 ? "✓ Ninguno" : `~${a11y.lowContrastTexts}`}
                    </span>
                  </div>
                </div>

                {/* Media */}
                {a11y.autoplaying > 0 && (
                  <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-red-700 mb-2">Media</h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-red-600">Autoplay detectado</span>
                      <span className="text-red-600 font-medium">✗ {a11y.autoplaying}</span>
                    </div>
                  </div>
                )}

                {/* Formularios */}
                {a11y.totalFormFields > 0 && (
                  <div className="border border-gray-200 rounded-lg p-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">Formularios</h4>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">Campos sin autocomplete</span>
                      <span className={a11y.formFieldsWithoutAutocomplete === 0 ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                        {a11y.formFieldsWithoutAutocomplete === 0 ? "✓" : `${a11y.formFieldsWithoutAutocomplete}/${a11y.totalFormFields}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-gray-400">Sin datos de accesibilidad</p>
                <p className="text-xs text-gray-300 mt-2">Ejecuta un análisis de captura de pantallas para obtener datos de accesibilidad</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* New annotation form - fixed at bottom */}
      <div className="border-t border-gray-100 px-5 py-4 flex-shrink-0 bg-gray-50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Nueva anotación
        </p>
        <form onSubmit={handleAddAnnotation} className="space-y-3">
          {/* Type selector */}
          <div className="flex gap-2">
            {(Object.keys(TYPE_CONFIG) as AnnotationType[]).map((t) => {
              const cfg = TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    newType === t
                      ? `${cfg.bg} ${cfg.color} border-current`
                      : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Escribe tu anotación..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleAddAnnotation(e as unknown as React.FormEvent);
              }
            }}
          />

          <button
            type="submit"
            disabled={saving || !newText.trim()}
            className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Guardando..." : "Guardar anotación"}
          </button>
          <p className="text-xs text-gray-400 text-center">⌘+Enter para guardar rápido</p>
        </form>
      </div>
      </div>{/* end main drawer */}
    </div>
  );
}
