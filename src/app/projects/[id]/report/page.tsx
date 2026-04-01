import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import type { Project, PageMeta, Annotation } from "@/types";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function getScoreColor(score: number) {
  if (score >= 8) return "#22c55e";
  if (score >= 5) return "#f59e0b";
  return "#ef4444";
}

function getScoreLabel(score: number) {
  if (score >= 8) return "Bueno";
  if (score >= 5) return "Mejorable";
  return "Urgente";
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  borrador:  { label: "Borrador",          color: "#9ca3af" },
  revision:  { label: "En revisión",       color: "#f59e0b" },
  aprobado:  { label: "Aprobado",          color: "#22c55e" },
  cambios:   { label: "Requiere cambios",  color: "#ef4444" },
};

const ANNOTATION_TYPE_CONFIG = {
  error:   { label: "Error",   color: "#ef4444" },
  mejora:  { label: "Mejora",  color: "#f59e0b" },
  nota:    { label: "Nota",    color: "#5a3bdd" },
};

function calculateSeoScore(seo: NonNullable<PageMeta["seo"]>): number {
  let score = 0;
  if (seo.titleLength >= 30 && seo.titleLength <= 60) score++;
  if (seo.descriptionLength >= 120 && seo.descriptionLength <= 160) score++;
  if (seo.h1.length > 0) score++;
  if (seo.h1.length === 1) score++;
  if (seo.hasOgTitle) score++;
  if (seo.hasOgDescription) score++;
  if (seo.hasOgImage) score++;
  if (seo.hasCanonical) score++;
  if (seo.totalImages === 0 || seo.imgWithoutAlt === 0) score++;
  if (seo.wordCount > 300) score++;
  return score;
}

function calculateA11yScore(a11y: NonNullable<PageMeta["a11y"]>): number {
  let score = 10;
  if (a11y.totalImages > 0 && a11y.imgWithoutAlt > 0) score--;
  if (a11y.buttonsWithoutLabel > 0) score--;
  if (a11y.inputsWithoutLabel > 0) score--;
  if (a11y.linksWithoutText > 0) score--;
  if (a11y.missingLang) score--;
  if (!a11y.headingOrderValid) score--;
  if (a11y.lowContrastTexts >= 3) score--;
  if (a11y.missingSkipLink) score--;
  if (a11y.missingMainLandmark) score--;
  if (a11y.autoplaying > 0) score--;
  return Math.max(0, score);
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const date = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Build page list from urls, enriched with pageMeta
  const pages = project.urls.map((url) => {
    const meta = project.pageMeta?.[url];
    const annotations = project.annotations?.[url] ?? [];
    const tagIds = project.pageTags?.[url] ?? [];
    const tags = tagIds
      .map((tid) => project.tags?.find((t) => t.id === tid))
      .filter(Boolean) as { id: string; name: string; color: string }[];
    const customName = project.pageNames?.[url];
    const pageState = project.pageStates?.[url];
    const displayImage =
      meta?.customImageUrl || meta?.thumbnailPath || meta?.screenshotPath;

    let title = customName || meta?.title || url;
    // Safely extract pathname from URL
    try {
      const pathname = new URL(url).pathname;
      if (!customName && !meta?.title && pathname !== "/") {
        title = pathname;
      }
    } catch {
      // If URL is invalid, keep the fallback
    }

    const seoScore = meta?.seo ? calculateSeoScore(meta.seo) : null;
    const a11yScore = meta?.a11y ? calculateA11yScore(meta.a11y) : null;

    return {
      url,
      meta,
      annotations,
      tags,
      pageState,
      displayImage,
      title,
      seoScore,
      a11yScore,
    };
  });

  const totalPages = pages.length;
  const pagesWithData = pages.filter((p) => p.seoScore !== null || p.a11yScore !== null).length;
  const pagesWithIssues = pages.filter(
    (p) =>
      (p.seoScore !== null && p.seoScore < 5) ||
      (p.a11yScore !== null && p.a11yScore < 5)
  ).length;
  const pagesApproved = pages.filter((p) => p.pageState === "aprobado").length;
  const totalAnnotations = pages.reduce((acc, p) => acc + p.annotations.length, 0);

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`Informe — ${project.name}`}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fa; color: #1a1c1e; }

          @media print {
            body { background: white; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
            .card { break-inside: avoid; page-break-inside: avoid; }
            @page { margin: 15mm; size: A4; }
          }

          .print-btn {
            position: fixed; bottom: 24px; right: 24px; z-index: 100;
            background: #5a3bdd; color: white; border: none; border-radius: 14px;
            padding: 14px 24px; font-size: 14px; font-weight: 700; cursor: pointer;
            box-shadow: 0 4px 20px rgba(90,59,221,0.35); display: flex; align-items: center; gap: 8px;
            transition: all 0.15s;
          }
          .print-btn:hover { background: #4a2fc8; transform: translateY(-1px); }

          .cover {
            min-height: 100vh; display: flex; flex-direction: column; justify-content: space-between;
            padding: 60px; background: white; margin-bottom: 40px;
          }
          .cover-logo { font-size: 13px; font-weight: 700; color: #9ca3af; letter-spacing: 0.1em; text-transform: uppercase; }
          .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 40px 0; }
          .cover-domain { font-size: 14px; color: #5a3bdd; font-weight: 600; margin-bottom: 12px; }
          .cover-title { font-size: 48px; font-weight: 800; color: #1a1c1e; line-height: 1.1; margin-bottom: 16px; }
          .cover-date { font-size: 16px; color: #6b7072; }
          .cover-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
          .stat-card { background: #f8f9fa; border-radius: 16px; padding: 20px; }
          .stat-number { font-size: 36px; font-weight: 800; color: #1a1c1e; }
          .stat-label { font-size: 12px; color: #6b7072; margin-top: 4px; font-weight: 500; }

          .section-header { padding: 20px 0 12px; font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; }

          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; padding: 0 0 40px; }

          .card {
            background: white; border-radius: 16px; overflow: hidden;
            border: 1px solid #e5e7eb; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
          }
          .card-image { width: 100%; aspect-ratio: 16/9; object-fit: cover; object-position: top; display: block; background: #f3f4f6; }
          .card-image-placeholder { width: 100%; aspect-ratio: 16/9; background: #f3f4f6; display: flex; align-items: center; justify-content: center; }
          .card-body { padding: 14px; }
          .card-title { font-size: 14px; font-weight: 700; color: #1a1c1e; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .card-url { font-size: 11px; color: #9ca3af; margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

          .scores { display: flex; gap: 8px; margin-bottom: 10px; }
          .score-badge { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }

          .status-badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px; }

          .tags { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 10px; }
          .tag { padding: 2px 8px; border-radius: 9999px; font-size: 10px; font-weight: 600; }

          .annotations { border-top: 1px solid #f3f4f6; padding-top: 10px; }
          .annotation { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 6px; font-size: 11px; color: #374151; line-height: 1.4; }
          .annotation-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }

          .container { max-width: 900px; margin: 0 auto; padding: 0 40px; }
        `}</style>
      </head>
      <body>
        {/* Print button (hidden when printing) */}
        <PrintButton />

        {/* Cover */}
        <div className="cover">
          <div className="cover-logo">Visual Sitemap</div>
          <div className="cover-main">
            <div className="cover-domain">{project.domain}</div>
            <div className="cover-title">{project.name}</div>
            <div className="cover-date">Informe generado el {date}</div>
          </div>
          <div className="cover-stats">
            <div className="stat-card">
              <div className="stat-number">{totalPages}</div>
              <div className="stat-label">Páginas analizadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: "#22c55e" }}>
                {pagesApproved}
              </div>
              <div className="stat-label">Páginas aprobadas</div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: pagesWithData === 0 ? "#9ca3af" : "#ef4444" }}>
                {pagesWithData === 0 ? "—" : pagesWithIssues}
              </div>
              <div className="stat-label">
                {pagesWithData === 0 ? "Issues (sin datos SEO)" : "Páginas con issues"}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-number" style={{ color: "#5a3bdd" }}>
                {totalAnnotations}
              </div>
              <div className="stat-label">Anotaciones</div>
            </div>
          </div>
        </div>

        {/* Pages grid */}
        <div className="container page-break">
          <div className="section-header">Inventario de páginas</div>
          <div className="grid">
            {pages.map((page) => (
              <div key={page.url} className="card">
                {page.displayImage ? (
                  <img
                    src={page.displayImage}
                    alt={page.title}
                    className="card-image"
                  />
                ) : (
                  <div className="card-image-placeholder">
                    <svg
                      width="32"
                      height="32"
                      fill="none"
                      stroke="#d1d5db"
                      strokeWidth="1.5"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}
                <div className="card-body">
                  <div className="card-title" title={page.title}>
                    {page.title}
                  </div>
                  <div className="card-url" title={page.url}>
                    {page.url}
                  </div>

                  {/* Status */}
                  {page.pageState && STATUS_CONFIG[page.pageState] && (
                    <div
                      className="status-badge"
                      style={{
                        background: `${STATUS_CONFIG[page.pageState].color}20`,
                        color: STATUS_CONFIG[page.pageState].color,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: STATUS_CONFIG[page.pageState].color,
                          display: "inline-block",
                        }}
                      />
                      {STATUS_CONFIG[page.pageState].label}
                    </div>
                  )}

                  {/* Scores */}
                  {(page.seoScore !== null || page.a11yScore !== null) && (
                    <div className="scores">
                      {page.seoScore !== null && (
                        <div
                          className="score-badge"
                          style={{
                            background: `${getScoreColor(page.seoScore)}15`,
                            color: getScoreColor(page.seoScore),
                          }}
                        >
                          SEO {page.seoScore}/10 · {getScoreLabel(page.seoScore)}
                        </div>
                      )}
                      {page.a11yScore !== null && (
                        <div
                          className="score-badge"
                          style={{
                            background: `${getScoreColor(page.a11yScore)}15`,
                            color: getScoreColor(page.a11yScore),
                          }}
                        >
                          A11y {page.a11yScore}/10 ·{" "}
                          {getScoreLabel(page.a11yScore)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tags */}
                  {page.tags.length > 0 && (
                    <div className="tags">
                      {page.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="tag"
                          style={{
                            background: `${tag.color}20`,
                            color: tag.color,
                          }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Annotations */}
                  {page.annotations.length > 0 && (
                    <div className="annotations">
                      {page.annotations.map((ann) => (
                        <div key={ann.id} className="annotation">
                          <span
                            className="annotation-dot"
                            style={{
                              background:
                                ANNOTATION_TYPE_CONFIG[ann.type]?.color ??
                                "#9ca3af",
                            }}
                          />
                          <span>{ann.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </body>
    </html>
  );
}
