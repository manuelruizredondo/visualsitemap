import { NextResponse } from "next/server";
import { getProject, deleteProject, updateProjectThumbnail, updatePageMeta, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";

type Params = { params: Promise<{ id: string }> };

/** Check that the project belongs to the current user */
async function authorizeProject(projectId: string) {
  const user = await getUser();
  const project = await getProject(projectId);

  if (!project) {
    return { project: null, error: NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 }) };
  }

  // Allow access if project has no userId (legacy) or if it matches current user
  if (project.userId && user && project.userId !== user.id) {
    return { project: null, error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) };
  }

  return { project, error: null };
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { project, error } = await authorizeProject(id);
  if (error) return error;
  return NextResponse.json({ project });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { error } = await authorizeProject(id);
  if (error) return error;
  await deleteProject(id);
  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { project, error } = await authorizeProject(id);
  if (error) return error;

  const body = await req.json();

  if (body.thumbnailUrl) {
    await updateProjectThumbnail(id, body.thumbnailUrl);
  }
  if (body.pageMeta) {
    await updatePageMeta(id, body.pageMeta);
  }
  if (body.name && project) {
    project.name = body.name.trim();
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
  }
  if (body.settings && project) {
    project.settings = { ...(project.settings ?? {}), ...body.settings };
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
  }

  return NextResponse.json({ ok: true });
}
