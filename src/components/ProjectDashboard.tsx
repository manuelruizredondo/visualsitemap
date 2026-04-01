"use client";

import { useState } from "react";
import Link from "next/link";
import ProjectCard from "./ProjectCard";
import AppLayout, { VIEW_CONFIG, type ViewType } from "./AppLayout";
import type { Project } from "@/types";

interface ProjectDashboardProps {
  initialProjects: Omit<Project, "tree">[];
  userEmail?: string;
}

export default function ProjectDashboard({ initialProjects, userEmail }: ProjectDashboardProps) {
  const [projects, setProjects] = useState(initialProjects);
  const [view, setView] = useState<ViewType>("recent");

  function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  function handleToggleFavorite(id: string, isFavorite: boolean) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isFavorite } : p))
    );
  }

  function handleToggleArchive(id: string, isArchived: boolean) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isArchived } : p))
    );
  }

  function handleThumbnailChange(id: string, thumbnailUrl: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, thumbnailUrl } : p))
    );
  }

  const filteredProjects = projects.filter((p) => {
    if (view === "favorites") return p.isFavorite && !p.isArchived;
    if (view === "archived") return p.isArchived;
    return !p.isArchived;
  });

  return (
    <AppLayout projects={projects} userEmail={userEmail} activeView={view} onViewChange={setView}>
      {/* Section title */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--ec-on-surface, #1a1c1e)" }}>
            {VIEW_CONFIG[view].label}
          </h1>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            minWidth: 28, height: 28, borderRadius: 9,
            padding: "0 6px", fontSize: 13, fontWeight: 600,
            background: "var(--ec-surface-container-low, #eff1f2)",
            color: "var(--ec-on-surface-variant, #6b7072)",
          }}>
            {filteredProjects.length}
          </span>
        </div>
        <Link
          href="/projects/new"
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 9999, textDecoration: "none",
            fontSize: 13, fontWeight: 600,
            background: "var(--ec-primary-container, #E2F162)",
            color: "#535c00", transition: "all 0.15s",
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo proyecto
        </Link>
      </div>

      {filteredProjects.length === 0 ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          paddingTop: 80, textAlign: "center",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20,
            background: "var(--ec-surface-container-low, #eff1f2)",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <svg width="36" height="36" style={{ color: "var(--ec-on-surface-variant, #6b7072)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ec-on-surface, #1a1c1e)", marginBottom: 4 }}>
            {view === "favorites" ? "Sin favoritos" : view === "archived" ? "Sin archivados" : "Sin proyectos todavía"}
          </h2>
          <p style={{ fontSize: 14, color: "var(--ec-on-surface-variant, #6b7072)", marginBottom: 24 }}>
            {view === "recent"
              ? "Crea tu primer sitemap visual a partir de una URL o un sitemap.xml"
              : view === "favorites"
              ? "Marca proyectos como favoritos para acceder rápidamente"
              : "Los proyectos archivados aparecerán aquí"}
          </p>
          {view === "recent" && (
            <Link
              href="/projects/new"
              style={{
                padding: "12px 24px", borderRadius: 9999, textDecoration: "none",
                fontSize: 14, fontWeight: 600,
                background: "var(--ec-primary-container, #E2F162)",
                color: "#535c00", transition: "all 0.15s",
              }}
            >
              Crear primer proyecto
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 20 }}>
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={handleDelete}
              onToggleFavorite={handleToggleFavorite}
              onToggleArchive={handleToggleArchive}
              onThumbnailChange={handleThumbnailChange}
            />
          ))}
          {/* New project card */}
          <Link
            href="/projects/new"
            style={{
              borderRadius: 20, border: "2px dashed var(--ec-surface-container-high, #c4c7c8)",
              background: "#fff", display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              minHeight: 200, gap: 8, textDecoration: "none",
              color: "var(--ec-on-surface-variant, #6b7072)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--ec-primary-container, #E2F162)";
              (e.currentTarget as HTMLElement).style.color = "var(--ec-secondary, #5a3bdd)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--ec-surface-container-high, #c4c7c8)";
              (e.currentTarget as HTMLElement).style.color = "var(--ec-on-surface-variant, #6b7072)";
            }}
          >
            <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Nuevo proyecto</span>
          </Link>
        </div>
      )}
    </AppLayout>
  );
}
