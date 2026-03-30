import { NextResponse } from "next/server";
import { addAnnotation, deleteAnnotation } from "@/lib/projects";
import type { AnnotationType } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const { url, text, type } = await req.json();

  if (!url || !text || !type) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const annotation = await addAnnotation(id, url, text, type as AnnotationType);
  return NextResponse.json({ annotation }, { status: 201 });
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params;
  const { url, annotationId } = await req.json();

  if (!url || !annotationId) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  await deleteAnnotation(id, url, annotationId);
  return new NextResponse(null, { status: 204 });
}
