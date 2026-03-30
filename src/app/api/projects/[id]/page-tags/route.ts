import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

// POST - toggle a tag on a page (add if not present, remove if present)
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { pageKey, tagId } = await req.json();
  if (!pageKey || !tagId) return NextResponse.json({ error: "pageKey y tagId requeridos" }, { status: 400 });

  if (!project.pageTags) project.pageTags = {};
  if (!project.pageTags[pageKey]) project.pageTags[pageKey] = [];

  const idx = project.pageTags[pageKey].indexOf(tagId);
  if (idx >= 0) {
    project.pageTags[pageKey].splice(idx, 1);
  } else {
    project.pageTags[pageKey].push(tagId);
  }

  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return NextResponse.json({ pageTags: project.pageTags[pageKey] });
}
