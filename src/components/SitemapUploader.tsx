"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";

export default function SitemapUploader() {
  const [xmlContent, setXmlContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setXmlContent(text);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!xmlContent.trim()) {
      setError("Pega o sube un archivo sitemap.xml");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/parse-sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml: xmlContent }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al procesar el sitemap");
        return;
      }

      // Store in sessionStorage for the canvas page
      sessionStorage.setItem("sitemapData", JSON.stringify(data));
      router.push("/sitemap-view");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="space-y-4">
        {/* File upload */}
        <div
          className="border-2 border-dashed border-[#c4c7c8] rounded-[20px] p-8 text-center cursor-pointer hover:border-[#E2F162] hover:bg-white transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xml"
            onChange={handleFileUpload}
            className="hidden"
          />
          <svg
            className="w-12 h-12 mx-auto text-[#6b7072] mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-[#1a1c1e] font-medium">
            Arrastra o haz clic para subir un archivo sitemap.xml
          </p>
          <p className="text-sm text-[#6b7072] mt-1">
            Formato XML
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-[#c4c7c8]" />
          <span className="text-sm text-[#6b7072]">o pega el XML</span>
          <div className="flex-1 h-px bg-[#c4c7c8]" />
        </div>

        {/* Textarea */}
        <Textarea
          value={xmlContent}
          onChange={(e) => { setXmlContent(e.target.value); setError(""); }}
          placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://ejemplo.com/</loc>\n  </url>\n  ...\n</urlset>'}
          className="h-48"
          mono
        />

        {/* Error */}
        {error && (
          <div className="bg-[#ffdad6] rounded-2xl p-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} disabled={loading}>
          {loading ? "Analizando..." : "Analizar Sitemap"}
        </Button>
      </div>
    </form>
  );
}
