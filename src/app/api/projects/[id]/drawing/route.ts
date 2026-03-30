import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
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
  const { pageKey, drawingData } = body as { pageKey: string; drawingData: string | null };

  if (!pageKey) {
    return NextResponse.json({ error: "pageKey es requerido" }, { status: 400 });
  }

  if (!project.pageDrawings) project.pageDrawings = {};

  if (drawingData) {
    project.pageDrawings[pageKey] = drawingData;
  } else {
    delete project.pageDrawings[pageKey];
  }

  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  return NextResponse.json({ ok: true });
}
