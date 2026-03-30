import { NextResponse } from "next/server";
import { parseSitemapXml, buildTree } from "@/lib/parse-sitemap";

const MAX_URLS = 200;

export async function POST(request: Request) {
  try {
    const { xml } = await request.json();

    if (!xml || typeof xml !== "string") {
      return NextResponse.json(
        { error: "Se requiere contenido XML" },
        { status: 400 }
      );
    }

    let urls = parseSitemapXml(xml);

    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron URLs en el sitemap" },
        { status: 400 }
      );
    }

    const truncated = urls.length > MAX_URLS;
    if (truncated) {
      urls = urls.slice(0, MAX_URLS);
    }

    const tree = buildTree(urls);

    return NextResponse.json({
      urls,
      tree,
      totalPages: urls.length,
      truncated,
      originalCount: truncated ? urls.length : undefined,
    });
  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json(
      { error: "Error al parsear el sitemap XML" },
      { status: 500 }
    );
  }
}
