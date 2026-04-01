import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProjectThumbnail } from "@/lib/projects";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "file es obligatorio" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const storagePath = `thumbnails/${id}/thumb_${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error } = await admin.storage
      .from("screenshots")
      .upload(storagePath, buffer, { contentType: file.type || "image/jpeg", upsert: true });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const thumbnailUrl = admin.storage
      .from("screenshots")
      .getPublicUrl(storagePath).data.publicUrl;

    await updateProjectThumbnail(id, thumbnailUrl);

    return NextResponse.json({ thumbnailUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir thumbnail" },
      { status: 500 }
    );
  }
}
