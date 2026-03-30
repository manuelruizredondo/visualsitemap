import { NextResponse } from "next/server";
import { fetchSitemapFromUrl } from "@/lib/fetch-sitemap";
import { parseSitemapXml } from "@/lib/parse-sitemap";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Se requiere una URL" }, { status: 400 });
    }

    const result = await fetchSitemapFromUrl(url);
    const urls = parseSitemapXml(result.xml);

    return NextResponse.json({
      xml: result.xml,
      sourceUrl: result.sourceUrl,
      urlCount: urls.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al buscar el sitemap" },
      { status: 400 }
    );
  }
}
