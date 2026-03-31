"use client";

import Link from "next/link";
import type { Project } from "@/types";
import UserMenu from "./UserMenu";

interface SidebarProps {
  projects: Omit<Project, "tree">[];
  activeId?: string;
  userEmail?: string;
  activeView?: "recent" | "favorites" | "archived";
  onViewChange?: (view: "recent" | "favorites" | "archived") => void;
}

function NavItem({
  href,
  label,
  icon,
  disabled,
  isActive,
  onClick,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}) {
  if (disabled && !onClick) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[#6b7072] text-sm cursor-not-allowed select-none">
        {icon}
        {label}
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
          isActive
            ? "text-[#1c0068] bg-[#e8e0ff]"
            : "text-[#9ba0a2] hover:text-white hover:bg-white/8"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <Link
      href={href || "#"}
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition-colors ${
        isActive
          ? "text-[#1c0068] bg-[#e8e0ff]"
          : "text-[#9ba0a2] hover:text-white hover:bg-white/8"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

export default function Sidebar({ projects, activeId, userEmail, activeView = "recent", onViewChange }: SidebarProps) {
  return (
    <aside className="w-60 m-[20px] rounded-[20px] min-h-[calc(100vh-40px)] bg-[#1a1c1e] text-white flex flex-col flex-shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/8">
        <Link href="/" className="flex items-center gap-2">
          <svg className="w-6 h-6 text-[#E2F162]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="font-semibold text-sm">Visual Sitemap</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-4 border-b border-white/8">
        <p className="px-3 mb-2 text-xs font-medium uppercase tracking-wider text-[#6b7072]">
          Navegar
        </p>
        <NavItem
          href="/"
          label="Recientes"
          isActive={activeView === "recent"}
          onClick={() => onViewChange?.("recent")}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <NavItem
          label="Favoritos"
          isActive={activeView === "favorites"}
          onClick={() => onViewChange?.("favorites")}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
        />
        <NavItem
          label="Archivo"
          isActive={activeView === "archived"}
          onClick={() => onViewChange?.("archived")}
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          }
        />
      </nav>

      {/* Projects list */}
      <div className="px-2 py-4 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[#6b7072]">
            Proyectos
          </p>
          <Link
            href="/projects/new"
            className="text-[#6b7072] hover:text-white transition-colors"
            title="Nuevo proyecto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="px-3 text-xs text-[#6b7072] italic">Sin proyectos</p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                    activeId === p.id
                      ? "bg-[#e8e0ff] text-[#1c0068]"
                      : "text-[#9ba0a2] hover:text-white hover:bg-white/8"
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-[#E2F162] text-[#535c00] flex items-center justify-center text-xs font-bold flex-shrink-0 uppercase">
                    {p.domain.charAt(0)}
                  </span>
                  <span className="truncate">{p.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* User menu */}
      {userEmail && (
        <div className="px-2 py-3 border-t border-white/8">
          <UserMenu email={userEmail} />
        </div>
      )}
    </aside>
  );
}
