import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import { processSingleScreenshot } from "@/lib/screenshot";

export const maxDuration = 60; // Single-page capture should finish within 1 min

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getUser();
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (project.userId && user && project.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const { url } = body as { url: string };

  if (!url) {
    return NextResponse.json({ error: "url es requerido" }, { status: 400 });
  }

  try {
    // Use existing screenshotJobId as the storage prefix, or fall back to project id
    const jobDir = project.screenshotJobId || project.id;
    const result = await processSingleScreenshot(jobDir, url);

    if (!project.pageMeta) project.pageMeta = {};
    const existing = project.pageMeta[url] ?? { title: "", description: "", screenshotPath: "" };

    project.pageMeta[url] = {
      ...existing,
      title: result.title || existing.title,
      description: result.description || existing.description,
      screenshotPath: result.screenshotPath || existing.screenshotPath,
      thumbnailPath: result.thumbnailPath || existing.thumbnailPath,
      seo: result.seo ?? existing.seo,
      a11y: result.a11y ?? existing.a11y,
    };

    // If this is the home page (root path), use its screenshot as the project thumbnail
    try {
      const parsedUrl = new URL(url);
      const isHome = parsedUrl.pathname === "/" || parsedUrl.pathname === "";
      if (isHome && (result.thumbnailPath || result.screenshotPath)) {
        project.thumbnailUrl = result.thumbnailPath || result.screenshotPath;
      }
    } catch {
      // ignore invalid URL
    }

    // Clear any saved drawing for this page (screenshot changed)
    if (project.pageDrawings?.[url]) {
      delete project.pageDrawings[url];
    }

    project.updatedAt = new Date().toISOString();
    await saveProject(project);

    return NextResponse.json({
      ok: true,
      result,
      pageMeta: project.pageMeta[url],
    });
  } catch (err) {
    console.error("Recapture error:", err);
    return NextResponse.json(
      { error: "Error al recapturar la página" },
      { status: 500 }
    );
  }
}
