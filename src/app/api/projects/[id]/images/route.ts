import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { updateCustomImage } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const key = formData.get("key") as string | null;

    if (!file || !key) {
      return NextResponse.json({ error: "file y key son obligatorios" }, { status: 400 });
    }

    const dir = path.join(process.cwd(), "public", "custom-images", id);
    await fs.mkdir(dir, { recursive: true });

    const ext = file.name.split(".").pop() || "jpg";
    const filename = `${key.replace(/[^a-z0-9_-]/gi, "_")}_${Date.now()}.${ext}`;
    const filePath = path.join(dir, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const customImageUrl = `/custom-images/${id}/${filename}`;
    await updateCustomImage(id, key, customImageUrl);

    return NextResponse.json({ customImageUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}
