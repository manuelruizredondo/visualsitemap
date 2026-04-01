import { NextResponse } from "next/server";
import { updatePageState } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const { pageKey, state } = await req.json();
  if (!pageKey) return NextResponse.json({ error: "pageKey requerido" }, { status: 400 });
  await updatePageState(id, pageKey, state ?? null);
  return NextResponse.json({ ok: true });
}
