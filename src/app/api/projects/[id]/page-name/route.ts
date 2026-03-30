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
  const { pageKey, name } = body as { pageKey: string; name: string };

  if (!pageKey || typeof name !== "string") {
    return NextResponse.json({ error: "pageKey y name son requeridos" }, { status: 400 });
  }

  if (!project.pageNames) project.pageNames = {};

  const trimmed = name.trim();
  if (trimmed) {
    project.pageNames[pageKey] = trimmed;
  } else {
    // Empty name = remove custom name (revert to auto-detected)
    delete project.pageNames[pageKey];
  }

  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  return NextResponse.json({ ok: true, name: trimmed || null });
}
