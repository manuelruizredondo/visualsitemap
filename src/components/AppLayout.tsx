"use client";

import { useState } from "react";
import Link from "next/link";
import UserMenu from "./UserMenu";
import type { Project } from "@/types";

type ViewType = "recent" | "favorites" | "archived";

const VIEW_CONFIG: Record<ViewType, { label: string; icon: React.ReactNode }> = {
  recent: {
    label: "Recientes",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  favorites: {
    label: "Favoritos",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  },
  archived: {
    label: "Archivo",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    ),
  },
};

export { VIEW_CONFIG };
export type { ViewType };

interface AppLayoutProps {
  projects: Omit<Project, "tree">[];
  userEmail?: string;
  activeView?: ViewType | null;
  onViewChange?: (view: ViewType) => void;
  children: React.ReactNode;
}

export default function AppLayout({ projects, userEmail, activeView = null, onViewChange, children }: AppLayoutProps) {
  const nonArchivedProjects = projects.filter((p) => !p.isArchived);

  return (
    <div style={{ minHeight: "100vh", background: "var(--ec-background, #f5f6f7)" }}>
      {/* ─── Floating top bar ─── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, padding: "10px 20px 0 20px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 6px 6px 16px", minHeight: 60,
          background: "#fff", borderRadius: 100,
          boxShadow: "0 4px 24px rgba(26,28,30,0.06), 0 1px 4px rgba(26,28,30,0.04)",
        }}>
          {/* Left: Logo + title */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
              <svg width="24" height="24" style={{ color: "var(--ec-secondary, #5a3bdd)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ec-on-surface, #1a1c1e)" }}>Visual Sitemap</span>
            </Link>
          </div>

          <div />
        </div>
      </div>

      {/* ─── Body: sidebar + content ─── */}
      <div style={{ display: "flex", padding: "10px 20px 40px", gap: 20, alignItems: "flex-start" }}>
        {/* ─── Sidebar ─── */}
        <aside style={{
          width: 220, flexShrink: 0, position: "sticky", top: 70,
          height: "calc(100vh - 70px - 10px)", overflowY: "auto",
          background: "#fff", borderRadius: 20, padding: "20px 10px",
          boxShadow: "0 2px 12px rgba(26,28,30,0.04)",
          display: "flex", flexDirection: "column",
        }}>
          {/* Top: nav + projects */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {/* Nav section */}
            <p style={{
              padding: "0 10px", marginBottom: 8,
              fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
              color: "var(--ec-on-surface-variant, #6b7072)",
            }}>
              Navegar
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {(["recent", "favorites", "archived"] as ViewType[]).map((v) => {
                const config = VIEW_CONFIG[v];
                const isActive = activeView === v;
                return onViewChange ? (
                  <button
                    key={v}
                    onClick={() => onViewChange(v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 12,
                      border: "none", cursor: "pointer", width: "100%",
                      fontSize: 13, fontWeight: isActive ? 600 : 500,
                      transition: "all 0.15s", textAlign: "left",
                      background: isActive ? "var(--ec-secondary-container, #e8e0ff)" : "transparent",
                      color: isActive ? "var(--ec-on-secondary-container, #1c0068)" : "var(--ec-on-surface-variant, #6b7072)",
                    }}
                  >
                    {config.icon}
                    {config.label}
                  </button>
                ) : (
                  <Link
                    key={v}
                    href={`/?view=${v}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 12,
                      textDecoration: "none", width: "100%",
                      fontSize: 13, fontWeight: 500,
                      transition: "all 0.15s",
                      background: "transparent",
                      color: "var(--ec-on-surface-variant, #6b7072)",
                    }}
                  >
                    {config.icon}
                    {config.label}
                  </Link>
                );
              })}
            </nav>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--ec-surface-container-high, #e0e2e3)", margin: "14px 10px" }} />

            {/* Projects section */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", marginBottom: 8 }}>
              <p style={{
                fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                color: "var(--ec-on-surface-variant, #6b7072)",
              }}>
                Proyectos
              </p>
              <Link
                href="/projects/new"
                style={{ color: "var(--ec-on-surface-variant, #6b7072)", display: "flex", transition: "color 0.15s" }}
                title="Nuevo proyecto"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            </div>

            {nonArchivedProjects.length === 0 ? (
              <p style={{ padding: "0 10px", fontSize: 12, color: "var(--ec-on-surface-variant, #6b7072)", fontStyle: "italic" }}>
                Sin proyectos
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {nonArchivedProjects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 10,
                      textDecoration: "none", transition: "background 0.15s",
                      fontSize: 13, color: "var(--ec-on-surface, #1a1c1e)",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low, #eff1f2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                      background: "var(--ec-primary-container, #E2F162)",
                      color: "#535c00", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                    }}>
                      {p.domain.charAt(0)}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.name}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Footer: help + user menu */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ height: 1, background: "var(--ec-surface-container-high, #e0e2e3)", margin: "10px 10px 8px" }} />
            <Link
              href="/help"
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 12,
                textDecoration: "none", width: "100%",
                fontSize: 13, fontWeight: 500,
                color: "var(--ec-on-surface-variant, #6b7072)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "var(--ec-surface-container-low, #eff1f2)"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--ec-on-surface, #1a1c1e)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "var(--ec-on-surface-variant, #6b7072)"; }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              Ayuda
            </Link>
            {userEmail && (
              <div style={{ padding: "4px 0 4px" }}>
                <UserMenu email={userEmail} />
              </div>
            )}
          </div>
        </aside>

        {/* ─── Main content ─── */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
