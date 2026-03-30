import { NextResponse } from "next/server";
import { addCustomNode } from "@/lib/projects";
import type { CustomNode } from "@/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const node: CustomNode = {
      id: body.id,
      label: body.label,
      parentNodeId: body.parentNodeId,
      position: body.position,
    };
    await addCustomNode(id, node);
    return NextResponse.json({ node }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear nodo" },
      { status: 500 }
    );
  }
}
