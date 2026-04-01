import { NextResponse } from "next/server";

/**
 * GET /api/screenshots/[jobId]
 *
 * Deprecated: job polling is no longer used.
 * Screenshots are now captured sequentially from the frontend
 * via /api/projects/[id]/recapture (one URL at a time).
 */
export async function GET() {
  return NextResponse.json(
    { error: "Job polling endpoint is deprecated." },
    { status: 410 }
  );
}
