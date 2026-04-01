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
        view !== "recent" ? (
          /* Simple empty for favorites / archived */
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            paddingTop: 80, textAlign: "center",
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: "var(--ec-surface-container-low, #eff1f2)",
              display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
            }}>
              <svg width="28" height="28" fill="none" stroke="var(--ec-on-surface-variant,#6b7072)" strokeWidth="1.5" viewBox="0 0 24 24">
                {view === "favorites"
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                }
              </svg>
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ec-on-surface,#1a1c1e)", marginBottom: 6 }}>
              {view === "favorites" ? "Sin favoritos" : "Sin archivados"}
            </p>
            <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant,#6b7072)" }}>
              {view === "favorites"
                ? "Marca proyectos con ★ para acceder rápidamente"
                : "Los proyectos archivados aparecerán aquí"}
            </p>
          </div>
        ) : (
          /* ── Full onboarding empty state ─────────────────────── */
          <div style={{ maxWidth: 760, margin: "0 auto", paddingTop: 40 }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: 52 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 80, height: 80, borderRadius: 24, marginBottom: 24,
                background: "linear-gradient(135deg, #5a3bdd 0%, #7c5cf5 100%)",
                boxShadow: "0 8px 32px rgba(90,59,221,0.3)",
              }}>
                <svg width="38" height="38" fill="none" stroke="#fff" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </div>
              <h2 style={{ fontSize: 32, fontWeight: 800, color: "var(--ec-on-surface,#1a1c1e)", marginBottom: 12, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                Visualiza cualquier web en segundos
              </h2>
              <p style={{ fontSize: 16, color: "var(--ec-on-surface-variant,#6b7072)", maxWidth: 480, margin: "0 auto 32px", lineHeight: 1.6 }}>
                Pega una URL o sube un sitemap.xml y obtén un mapa visual interactivo con screenshots, análisis SEO y herramientas de revisión.
              </p>
              <Link
                href="/projects/new"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 28px", borderRadius: 9999, textDecoration: "none",
                  fontSize: 15, fontWeight: 700,
                  background: "linear-gradient(135deg, #5a3bdd 0%, #7c5cf5 100%)",
                  color: "#fff", boxShadow: "0 4px 20px rgba(90,59,221,0.35)",
                  transition: "all 0.15s",
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Crear mi primer sitemap
              </Link>
            </div>

            {/* Feature cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 40 }}>
              {[
                {
                  icon: (
                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  ),
                  color: "#5a3bdd",
                  title: "Screenshots automáticos",
                  desc: "Captura visual de cada página de tu sitio al instante.",
                },
                {
                  icon: (
                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ),
                  color: "#059669",
                  title: "Auditoría SEO y A11y",
                  desc: "Puntuación SEO y accesibilidad para cada URL detectada.",
                },
                {
                  icon: (
                    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  ),
                  color: "#d97706",
                  title: "Comparte y exporta",
                  desc: "Link público de solo lectura o exporta el informe a PDF.",
                },
              ].map((f) => (
                <div key={f.title} style={{
                  background: "#fff", borderRadius: 16, padding: "20px 20px 22px",
                  border: "1px solid var(--ec-surface-container-high,#e5e7eb)",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, marginBottom: 14,
                    background: `${f.color}15`, color: f.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {f.icon}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ec-on-surface,#1a1c1e)", marginBottom: 6 }}>
                    {f.title}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ec-on-surface-variant,#6b7072)", lineHeight: 1.5 }}>
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div style={{
              background: "var(--ec-surface-container-lowest,#fff)",
              border: "1px solid var(--ec-surface-container-high,#e5e7eb)",
              borderRadius: 16, padding: "24px 28px",
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ec-on-surface-variant,#6b7072)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 18 }}>
                Cómo funciona
              </p>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                {[
                  { n: "1", title: "Pega tu URL", desc: "o sube un sitemap.xml" },
                  { n: "2", title: "Generamos el mapa", desc: "con estructura jerárquica" },
                  { n: "3", title: "Capturamos screenshots", desc: "de cada página automáticamente" },
                  { n: "4", title: "Revisa y exporta", desc: "estados, anotaciones y PDF" },
                ].map((step, i, arr) => (
                  <div key={step.n} style={{ display: "flex", alignItems: "flex-start", flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: "50%", marginBottom: 10,
                        background: "linear-gradient(135deg,#5a3bdd,#7c5cf5)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#fff", fontSize: 14, fontWeight: 800, flexShrink: 0,
                      }}>
                        {step.n}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "var(--ec-on-surface,#1a1c1e)", textAlign: "center", marginBottom: 2 }}>
                        {step.title}
                      </p>
                      <p style={{ fontSize: 12, color: "var(--ec-on-surface-variant,#6b7072)", textAlign: "center" }}>
                        {step.desc}
                      </p>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{ height: 2, background: "var(--ec-surface-container-high,#e5e7eb)", flex: "0 0 20px", marginTop: 16, flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
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
