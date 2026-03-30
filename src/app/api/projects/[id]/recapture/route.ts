import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import { processSingleScreenshot } from "@/lib/screenshot";

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
    // Use existing screenshotJobId directory, or create a new one
    const jobDir = project.screenshotJobId || project.id;
    const result = await processSingleScreenshot(jobDir, url);

    // Update pageMeta with new screenshot data
    if (!project.pageMeta) project.pageMeta = {};
    const existing = project.pageMeta[url] ?? { title: "", description: "", screenshotPath: "" };

    project.pageMeta[url] = {
      ...existing,
      title: result.title || existing.title,
      description: result.description || existing.description,
      screenshotPath: result.screenshotPath || existing.screenshotPath,
      seo: result.seo ?? existing.seo,
    };

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
