"use client";

import dynamic from "next/dynamic";
import { use } from "react";

const SitemapCanvas = dynamic(() => import("@/components/SitemapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Cargando proyecto...</p>
      </div>
    </div>
  ),
});

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SitemapCanvas projectId={id} />;
}
