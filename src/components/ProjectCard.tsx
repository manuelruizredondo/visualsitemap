"use client";

import { useState } from "react";
import Link from "next/link";
import type { Project } from "@/types";

interface ProjectCardProps {
  project: Omit<Project, "tree">;
  onDelete: (id: string) => void;
  onToggleFavorite?: (id: string, isFavorite: boolean) => void;
  onToggleArchive?: (id: string, isArchived: boolean) => void;
  onThumbnailChange?: (id: string, thumbnailUrl: string) => void;
}

const GRADIENT_COLORS = [
  "from-blue-400 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-rose-400 to-pink-600",
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-sky-600",
];

function getGradient(id: string) {
  const sum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENT_COLORS[sum % GRADIENT_COLORS.length];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProjectCard({ project, onDelete, onToggleFavorite, onToggleArchive, onThumbnailChange }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [localThumbnail, setLocalThumbnail] = useState(project.thumbnailUrl);

  async function handleThumbnailDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/projects/${project.id}/thumbnail`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.thumbnailUrl) {
        setLocalThumbnail(data.thumbnailUrl);
        onThumbnailChange?.(project.id, data.thumbnailUrl);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setMenuOpen(false);
    setConfirming(false);
    await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
    onDelete(project.id);
  }

  async function handleToggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/projects/${project.id}/favorite`, { method: "POST" });
      const data = await response.json();
      onToggleFavorite?.(project.id, data.isFavorite);
      setMenuOpen(false);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  }

  async function handleToggleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const response = await fetch(`/api/projects/${project.id}/archive`, { method: "POST" });
      const data = await response.json();
      onToggleArchive?.(project.id, data.isArchived);
      setMenuOpen(false);
    } catch (error) {
      console.error("Error toggling archive:", error);
    }
  }

  return (
    <div className="rounded-[20px] bg-white hover:shadow-lg transition-all group relative" style={{ boxShadow: "0 4px 30px rgba(26,28,30,0.04)" }}>
      <Link href={`/projects/${project.id}`} className="block">
        {/* Thumbnail */}
        <div
          className={`relative h-40 rounded-t-[20px] overflow-hidden bg-gradient-to-br ${getGradient(project.id)}`}
          style={{ transition: "box-shadow 0.15s" }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
          onDragLeave={(e) => { e.stopPropagation(); setDragOver(false); }}
          onDrop={handleThumbnailDrop}
        >
          {dragOver && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "rgba(90,59,221,0.55)", pointerEvents: "none", backdropFilter: "blur(2px)" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Suelta para cambiar portada</span>
            </div>
          )}
          {uploading && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)" }}>
              <div style={{ width: 24, height: 24, border: "3px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          {localThumbnail ? (
            <img
              src={localThumbnail}
              alt={project.name}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-5xl font-bold text-white/30 uppercase select-none">
                {project.domain.charAt(0)}
              </span>
            </div>
          )}
          {project.isFavorite && (
            <div className="absolute bottom-2 left-2">
              <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-4">
          <h3 className="font-semibold text-[#1a1c1e] truncate">{project.name}</h3>
          <p className="text-sm text-[#6b7072] truncate mt-0.5">{project.domain}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-[#6b7072]">{formatDate(project.updatedAt)}</p>
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 26, height: 26, borderRadius: 8, padding: "0 6px",
              background: "var(--ec-surface-container-low, #eff1f2)",
              fontSize: 11, fontWeight: 600, color: "#6b7072",
            }}>{project.urls.length}</span>
          </div>
        </div>
      </Link>

      {/* Three-dot menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((o) => !o);
              setConfirming(false);
            }}
            className="w-7 h-7 rounded-lg bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  setConfirming(false);
                }}
              />
              <div className="absolute right-0 top-8 z-20 rounded-2xl py-1 w-48" style={{ background: "rgba(255, 255, 255, 0.80)", backdropFilter: "blur(20px)" }}>
                <button
                  onClick={handleToggleFavorite}
                  className="w-full text-left px-3 py-2 text-sm text-[#1a1c1e] hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <svg className={`w-4 h-4 ${project.isFavorite ? "fill-yellow-400 text-yellow-400" : "text-[#6b7072]"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {project.isFavorite ? "Quitar favorito" : "Marcar favorito"}
                </button>
                <button
                  onClick={handleToggleArchive}
                  className="w-full text-left px-3 py-2 text-sm text-[#1a1c1e] hover:bg-white/20 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-[#6b7072]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {project.isArchived ? "Desarchivar" : "Archivar"}
                </button>
                <div className="border-t border-white/20" />
                <button
                  onClick={handleDelete}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    confirming
                      ? "text-white bg-red-500 hover:bg-red-600"
                      : "text-red-600 hover:bg-red-100"
                  }`}
                >
                  {confirming ? "¿Confirmar?" : "Eliminar proyecto"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
