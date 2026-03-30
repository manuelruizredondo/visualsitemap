import { NextResponse } from "next/server";
import { getProject, saveProject } from "@/lib/projects";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string }> };

// GET - list all tags for project
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ tags: project.tags ?? [] });
}

// POST - create a new tag
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { name, color } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const tag: { id: string; name: string; color: string } = {
    id: uuidv4(),
    name: name.trim().toUpperCase(),
    color: color || "#6b7280",
  };

  if (!project.tags) project.tags = [];
  project.tags.push(tag);
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return NextResponse.json({ tag }, { status: 201 });
}

// DELETE - delete a tag (and remove from all pages)
export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { tagId } = await req.json();
  project.tags = (project.tags ?? []).filter((t) => t.id !== tagId);

  // Remove tag from all pages
  if (project.pageTags) {
    for (const key of Object.keys(project.pageTags)) {
      project.pageTags[key] = project.pageTags[key].filter((id) => id !== tagId);
    }
  }

  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return NextResponse.json({ ok: true });
}

// PATCH - update a tag name/color
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { tagId, name, color } = await req.json();
  const tag = (project.tags ?? []).find((t) => t.id === tagId);
  if (!tag) return NextResponse.json({ error: "Tag no encontrado" }, { status: 404 });

  if (name) tag.name = name.trim().toUpperCase();
  if (color) tag.color = color;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return NextResponse.json({ tag });
}
