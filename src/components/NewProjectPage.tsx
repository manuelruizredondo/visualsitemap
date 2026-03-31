"use client";

import Link from "next/link";
import AppLayout from "./AppLayout";
import type { Project } from "@/types";

interface NewProjectPageProps {
  projects: Omit<Project, "tree">[];
  userEmail?: string;
  children: React.ReactNode;
}

export default function NewProjectPage({ projects, userEmail, children }: NewProjectPageProps) {
  return (
    <AppLayout projects={projects} userEmail={userEmail}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 160px)" }}>
        <div style={{
          width: "100%", maxWidth: 520,
          background: "#fff", borderRadius: 20, padding: 32,
          boxShadow: "0 4px 30px rgba(26,28,30,0.04)",
        }}>
          <div style={{ marginBottom: 24 }}>
            <Link
              href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 13, color: "var(--ec-on-surface-variant, #6b7072)",
                textDecoration: "none", marginBottom: 16, transition: "color 0.15s",
              }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a proyectos
            </Link>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--ec-on-surface, #1a1c1e)", marginTop: 12 }}>
              Nuevo proyecto
            </h1>
            <p style={{ fontSize: 14, color: "var(--ec-on-surface-variant, #6b7072)", marginTop: 4 }}>
              Analiza un sitio web o importa un sitemap.xml
            </p>
          </div>

          {children}
        </div>
      </div>
    </AppLayout>
  );
}
