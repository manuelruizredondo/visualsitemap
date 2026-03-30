import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { listProjects, saveProject } from "@/lib/projects";
import { parseSitemapXml, buildTree } from "@/lib/parse-sitemap";
import { fetchSitemapFromUrl } from "@/lib/fetch-sitemap";
import { createJob, processScreenshots } from "@/lib/screenshot";
import { getUser } from "@/lib/supabase/auth";
import type { Project } from "@/types";

const MAX_URLS = 200;

export async function GET() {
  const user = await getUser();
  const allProjects = await listProjects();

  // Filter by user if authenticated
  const projects = user
    ? allProjects.filter((p) => p.userId === user.id)
    : allProjects;

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, xml, url } = body as {
      name: string;
      xml?: string;
      url?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
    }
    if (!xml && !url) {
      return NextResponse.json(
        { error: "Se requiere xml o url" },
        { status: 400 }
      );
    }

    // Get XML content
    let sitemapXml = xml;
    if (!sitemapXml && url) {
      const result = await fetchSitemapFromUrl(url);
      sitemapXml = result.xml;
    }

    // Parse URLs
    let urls = parseSitemapXml(sitemapXml!);
    if (urls.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron URLs en el sitemap" },
        { status: 400 }
      );
    }

    const truncated = urls.length > MAX_URLS;
    if (truncated) urls = urls.slice(0, MAX_URLS);

    const tree = buildTree(urls);

    // Extract domain
    let domain = name;
    try {
      domain = new URL(urls[0]).host;
    } catch {}

    const user = await getUser();

    const id = uuidv4();
    const now = new Date().toISOString();

    const project: Project = {
      id,
      name: name.trim(),
      domain,
      createdAt: now,
      updatedAt: now,
      urls,
      tree,
      pageMeta: {},
      annotations: {},
      customNodes: [],
      userId: user?.id,
    };

    await saveProject(project);

    // Start screenshot job
    const jobId = uuidv4();
    createJob(jobId, urls);
    processScreenshots(jobId, urls); // fire and forget

    project.screenshotJobId = jobId;
    await saveProject(project);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tree: _, ...meta } = project;
    return NextResponse.json({ project: meta }, { status: 201 });
  } catch (err) {
    console.error("Create project error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al crear el proyecto" },
      { status: 500 }
    );
  }
}
