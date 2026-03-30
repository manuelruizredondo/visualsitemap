import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createJob, processScreenshots } from "@/lib/screenshot";

export async function POST(request: Request) {
  try {
    const { urls } = await request.json();

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: "Se requiere un array de URLs" },
        { status: 400 }
      );
    }

    const jobId = uuidv4();
    createJob(jobId, urls);

    // Start processing in background (don't await)
    processScreenshots(jobId, urls);

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error("Screenshot job creation error:", err);
    return NextResponse.json(
      { error: "Error al crear el job de capturas" },
      { status: 500 }
    );
  }
}
