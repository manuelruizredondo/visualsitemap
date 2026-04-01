import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { after } from "next/server";
import { createJob, processScreenshots } from "@/lib/screenshot";

export const maxDuration = 300; // Allow up to 5 min for screenshot processing

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
    await createJob(jobId, urls);

    // Process screenshots in the background after sending the response
    after(processScreenshots(jobId, urls));

    return NextResponse.json({ jobId });
  } catch (err) {
    console.error("Screenshot job creation error:", err);
    return NextResponse.json(
      { error: "Error al crear el job de capturas" },
      { status: 500 }
    );
  }
}
