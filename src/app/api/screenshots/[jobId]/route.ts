import { NextResponse } from "next/server";
import { getJob } from "@/lib/screenshot";

export const maxDuration = 10; // Job status reads are fast

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await getJob(jobId);

  if (!job) {
    return NextResponse.json(
      { error: "Job no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
