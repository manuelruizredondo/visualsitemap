import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const safeKey = key.replace(/[^a-z0-9_-]/gi, "_");
    const storagePath = `custom/${id}/${safeKey}_${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const admin = createAdminClient();

    const { error } = await admin.storage
      .from("screenshots")
      .upload(storagePath, buffer, { contentType: file.type || "image/jpeg", upsert: true });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const customImageUrl = admin.storage
      .from("screenshots")
      .getPublicUrl(storagePath).data.publicUrl;

    await updateCustomImage(id, key, customImageUrl);

    return NextResponse.json({ customImageUrl }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al subir imagen" },
      { status: 500 }
    );
  }
}
