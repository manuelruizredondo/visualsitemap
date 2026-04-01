import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";
import { v4 as uuidv4 } from "uuid";

export const maxDuration = 10;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/recapture-all
 *
 * Prepares the project for a full re-capture:
 *   - Generates a new storage prefix (jobId)
 *   - Clears saved drawings
 *   - Returns the list of URLs so the **frontend** can call
 *     /api/projects/[id]/recapture for each one sequentially.
 *
 * This avoids running a long background task that exceeds
 * Vercel's serverless function timeout.
 */
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

  const urls = project.urls.filter((u) => u.startsWith("http"));
  if (urls.length === 0) {
    return NextResponse.json({ error: "No hay URLs para recapturar" }, { status: 400 });
  }

  const jobId = uuidv4();

  // Clear drawings (screenshots are changing) and save new jobId
  project.pageDrawings = {};
  project.screenshotJobId = jobId;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  return NextResponse.json({ jobId, urls, total: urls.length });
}
