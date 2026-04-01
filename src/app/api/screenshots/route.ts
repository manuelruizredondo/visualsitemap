import { NextResponse } from "next/server";

/**
 * POST /api/screenshots
 *
 * Deprecated: batch screenshot processing is no longer used.
 * Screenshots are now captured sequentially from the frontend
 * via /api/projects/[id]/recapture (one URL at a time).
 */
export async function POST() {
  return NextResponse.json(
    { error: "Batch screenshot endpoint is deprecated. Use /api/projects/[id]/recapture instead." },
    { status: 410 }
  );
}
