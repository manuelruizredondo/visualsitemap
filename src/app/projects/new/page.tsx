import Link from "next/link";
import CreateProjectForm from "@/components/CreateProjectForm";
import { listProjects } from "@/lib/projects";
import Sidebar from "@/components/Sidebar";

export default async function NewProjectPage() {
  const projects = await listProjects();

  return (
    <div className="flex min-h-screen">
      <Sidebar projects={projects} />

      <main className="flex-1 bg-gray-50 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-4 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver a proyectos
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Nuevo proyecto</h1>
            <p className="text-gray-500 text-sm mt-1">
              Analiza un sitio web o importa un sitemap.xml
            </p>
          </div>

          <CreateProjectForm />
        </div>
      </main>
    </div>
  );
}
