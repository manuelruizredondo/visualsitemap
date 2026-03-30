import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  project.isFavorite = !project.isFavorite;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return NextResponse.json({ isFavorite: project.isFavorite });
}
