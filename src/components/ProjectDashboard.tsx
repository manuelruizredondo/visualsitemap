"use client";

import { useState } from "react";
import Link from "next/link";
import Sidebar from "./Sidebar";
import ProjectCard from "./ProjectCard";
import type { Project } from "@/types";

interface ProjectDashboardProps {
  initialProjects: Omit<Project, "tree">[];
  userEmail?: string;
}

type ViewType = "recent" | "favorites" | "archived";

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

  const filteredProjects = projects.filter((p) => {
    if (view === "favorites") return p.isFavorite && !p.isArchived;
    if (view === "archived") return p.isArchived;
    return !p.isArchived;
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} userEmail={userEmail} activeView={view} onViewChange={setView} />

      <main className="flex-1 bg-gray-50 overflow-y-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Mis proyectos</h1>
            <Link
              href="/projects/new"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo proyecto
            </Link>
          </div>

          {/* Empty state */}
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-1">Sin proyectos todavía</h2>
              <p className="text-gray-400 mb-6">
                Crea tu primer sitemap visual a partir de una URL o un sitemap.xml
              </p>
              <Link
                href="/projects/new"
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium transition-colors"
              >
                Crear primer proyecto
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDelete}
                  onToggleFavorite={handleToggleFavorite}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
              {/* New project card */}
              <Link
                href="/projects/new"
                className="rounded-xl border-2 border-dashed border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 transition-all flex flex-col items-center justify-center h-full min-h-[200px] gap-2 text-gray-400 hover:text-blue-500"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Nuevo proyecto</span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
