import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";
import { createJob, processScreenshots } from "@/lib/screenshot";

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

  // Collect all valid URLs from the project
  const urls = project.urls.filter((u) => u.startsWith("http"));
  if (urls.length === 0) {
    return NextResponse.json({ error: "No hay URLs para recapturar" }, { status: 400 });
  }

  // Create a new screenshot job
  const jobId = uuidv4();
  createJob(jobId, urls);

  // Clear all saved drawings (screenshots are changing)
  project.pageDrawings = {};
  project.screenshotJobId = jobId;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  // Fire and forget — processing runs in background
  processScreenshots(jobId, urls).then(async () => {
    // When done, save all page meta to the project
    const { getJob } = await import("@/lib/screenshot");
    const job = getJob(jobId);
    if (!job || job.status !== "complete") return;

    const freshProject = await getProject(id);
    if (!freshProject) return;

    for (const r of job.results) {
      if (r.screenshotPath && !r.error) {
        freshProject.pageMeta[r.url] = {
          title: r.title,
          description: r.description || "",
          screenshotPath: r.screenshotPath,
          seo: r.seo,
          customImageUrl: freshProject.pageMeta[r.url]?.customImageUrl,
        };
      }
    }

    // Set thumbnail from first successful result
    const firstGood = job.results.find((r) => r.screenshotPath && !r.error);
    if (firstGood) {
      freshProject.thumbnailUrl = firstGood.screenshotPath;
    }

    freshProject.updatedAt = new Date().toISOString();
    await saveProject(freshProject);
  });

  return NextResponse.json({ jobId, total: urls.length });
}
