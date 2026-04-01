import { NextResponse } from "next/server";
import { getProject, setProjectShareToken } from "@/lib/projects";
import { v4 as uuidv4 } from "uuid";

type Params = { params: Promise<{ id: string }> };

// POST → toggle share on/off
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  if (project.shareToken) {
    // disable sharing
    await setProjectShareToken(id, null);
    return NextResponse.json({ shareToken: null });
  } else {
    const token = uuidv4();
    await setProjectShareToken(id, token);
    return NextResponse.json({ shareToken: token });
  }
}
