"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type SourceTab = "url" | "file" | "paste";

export default function CreateProjectForm() {
  const [name, setName] = useState("");
  const [tab, setTab] = useState<SourceTab>("url");
  const [siteUrl, setSiteUrl] = useState("");
  const [xmlContent, setXmlContent] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleVerifyUrl() {
    if (!siteUrl.trim()) return;
    setVerifying(true);
    setVerifyStatus(null);
    try {
      const res = await fetch("/api/fetch-sitemap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyStatus({ ok: false, message: data.error });
      } else {
        setVerifyStatus({
          ok: true,
          message: `✓ ${data.urlCount} URLs encontradas en ${data.sourceUrl}`,
        });
      }
    } catch {
      setVerifyStatus({ ok: false, message: "Error de conexión" });
    } finally {
      setVerifying(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setXmlContent(text);
    if (!name) setName(file.name.replace(".xml", ""));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre del proyecto es obligatorio");
      return;
    }
    if (tab === "url" && !siteUrl.trim()) {
      setError("Introduce una URL");
      return;
    }
    if ((tab === "file" || tab === "paste") && !xmlContent.trim()) {
      setError("Introduce el contenido XML");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const body: Record<string, string> = { name };
      if (tab === "url") {
        body.url = siteUrl;
      } else {
        body.xml = xmlContent;
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear el proyecto");
        return;
      }

      router.push(`/projects/${data.project.id}`);
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const tabs: { id: SourceTab; label: string }[] = [
    { id: "url", label: "URL del sitio" },
    { id: "file", label: "Subir XML" },
    { id: "paste", label: "Pegar XML" },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Project name */}
      <div>
        <label className="block text-sm font-medium text-[#1a1c1e] mb-1">
          Nombre del proyecto <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi sitio web"
          className="w-full px-4 py-2.5 bg-[#eff1f2] rounded-full focus:outline-none transition-all"
          style={{ boxShadow: "inset 0 0 0 1px transparent" }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = "inset 0 0 0 2px rgba(226, 241, 98, 0.3)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent";
          }}
        />
      </div>

      {/* Source tabs */}
      <div>
        <label className="block text-sm font-medium text-[#1a1c1e] mb-2">
          Fuente del sitemap
        </label>
        <div className="flex gap-1 bg-[#eff1f2] p-1 rounded-full mb-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setError(""); setVerifyStatus(null); }}
              className={`flex-1 py-2 px-3 rounded-full text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-white text-[#1a1c1e] shadow-sm"
                  : "text-[#6b7072] hover:text-[#1a1c1e]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* URL tab */}
        {tab === "url" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => { setSiteUrl(e.target.value); setVerifyStatus(null); }}
                placeholder="https://ejemplo.com"
                className="flex-1 px-4 py-2.5 bg-[#eff1f2] rounded-full focus:outline-none transition-all"
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = "inset 0 0 0 2px rgba(226, 241, 98, 0.3)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent";
                }}
              />
              <button
                type="button"
                onClick={handleVerifyUrl}
                disabled={verifying || !siteUrl.trim()}
                className="px-4 py-2.5 bg-[#eff1f2] text-[#1a1c1e] rounded-full hover:bg-[#e0e3e4] disabled:opacity-50 text-sm font-medium whitespace-nowrap transition-colors"
              >
                {verifying ? "Buscando..." : "Verificar"}
              </button>
            </div>
            {verifyStatus && (
              <p
                className={`text-sm ${
                  verifyStatus.ok ? "text-green-600" : "text-red-600"
                }`}
              >
                {verifyStatus.message}
              </p>
            )}
            <p className="text-xs text-[#6b7072]">
              Se buscará automáticamente en /sitemap.xml, /sitemap_index.xml y robots.txt
            </p>
          </div>
        )}

        {/* File tab */}
        {tab === "file" && (
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
            <svg className="w-10 h-10 mx-auto text-[#6b7072] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            {xmlContent ? (
              <p className="text-green-600 font-medium text-sm">✓ Archivo cargado</p>
            ) : (
              <>
                <p className="text-[#1a1c1e] font-medium text-sm">Arrastra o haz clic para subir un sitemap.xml</p>
              </>
            )}
          </div>
        )}

        {/* Paste tab */}
        {tab === "paste" && (
          <textarea
            value={xmlContent}
            onChange={(e) => { setXmlContent(e.target.value); setError(""); }}
            placeholder={'<?xml version="1.0" encoding="UTF-8"?>\n<urlset ...>\n  <url><loc>https://...</loc></url>\n</urlset>'}
            className="w-full h-48 p-4 bg-[#eff1f2] rounded-2xl font-mono text-sm resize-none focus:outline-none transition-all"
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "inset 0 0 0 2px rgba(226, 241, 98, 0.3)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "inset 0 0 0 1px transparent";
            }}
          />
        )}
      </div>

      {error && (
        <div className="bg-[#ffdad6] rounded-2xl p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 px-6 bg-[#E2F162] text-[#535c00] font-semibold rounded-full hover:bg-[#E2F162]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Creando proyecto...
          </span>
        ) : (
          "Crear proyecto"
        )}
      </button>
    </form>
  );
}
