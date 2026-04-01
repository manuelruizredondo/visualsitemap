import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { getProject, saveProject } from "@/lib/projects";
import { getUser } from "@/lib/supabase/auth";

const execAsync = promisify(exec);

type Params = { params: Promise<{ id: string }> };

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

/**
 * Normalise a string for URL-matching:
 * lowercase, replace any run of non-alphanumeric chars with a single underscore,
 * strip leading/trailing underscores.
 */
function normalise(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Try to match a filename (without extension) to one of the project URLs.
 * Returns the matched URL or null.
 *
 * Strategy: for each project URL we compute several candidate normalisations
 * and compare against the normalised filename.
 */
function matchFilenameToUrl(filename: string, urls: string[]): string | null {
  const normFilename = normalise(filename);

  for (const url of urls) {
    // Candidate 1: full URL normalised ("https://example.com/about" → "https_example_com_about")
    const full = normalise(url);
    if (full === normFilename) return url;

    // Candidate 2: strip protocol first ("example.com/about" → "example_com_about")
    const noProto = normalise(url.replace(/^https?:\/\//, ""));
    if (noProto === normFilename) return url;

    // Candidate 3: noProto without trailing slash or index
    const noTrail = normalise(
      url.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/\/index$/, "")
    );
    if (noTrail === normFilename) return url;
  }

  // Fallback: the normalised filename contains the normalised URL path (handles extra suffixes like timestamps)
  for (const url of urls) {
    const noProto = normalise(url.replace(/^https?:\/\//, ""));
    if (normFilename.startsWith(noProto + "_") || normFilename === noProto) return url;
    const full = normalise(url);
    if (normFilename.startsWith(full + "_") || normFilename === full) return url;
  }

  return null;
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getUser();
  const project = await getProject(id);

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }
  if (project.userId && user && project.userId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // Parse the multipart form
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "No se pudo leer el formulario" }, { status: 400 });
  }

  const zipFile = formData.get("file") as File | null;
  if (!zipFile) {
    return NextResponse.json({ error: "Falta el campo 'file'" }, { status: 400 });
  }

  if (!zipFile.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "El archivo debe ser un ZIP" }, { status: 400 });
  }

  // Write ZIP to a temp directory
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vs-zip-"));
  const zipPath = path.join(tmpDir, "upload.zip");
  const extractDir = path.join(tmpDir, "extracted");

  try {
    const buffer = Buffer.from(await zipFile.arrayBuffer());
    await fs.writeFile(zipPath, buffer);

    // Extract using system unzip
    await execAsync(`unzip -o "${zipPath}" -d "${extractDir}"`);

    // Recursively find all image files
    const { stdout } = await execAsync(`find "${extractDir}" -type f`);
    const allFiles = stdout.trim().split("\n").filter(Boolean);
    const imageFiles = allFiles.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext);
    });

    if (imageFiles.length === 0) {
      return NextResponse.json({ error: "El ZIP no contiene imágenes" }, { status: 400 });
    }

    // Prepare the custom-images directory for this project
    const destDir = path.join(process.cwd(), "public", "custom-images", id);
    await fs.mkdir(destDir, { recursive: true });

    const projectUrls = project.urls ?? [];
    const results: { filename: string; url: string | null; saved: boolean }[] = [];

    if (!project.pageMeta) project.pageMeta = {};

    for (const filePath of imageFiles) {
      const basename = path.basename(filePath);
      const ext = path.extname(basename).toLowerCase();
      const nameWithoutExt = path.basename(basename, ext);

      const matchedUrl = matchFilenameToUrl(nameWithoutExt, projectUrls);

      if (!matchedUrl) {
        results.push({ filename: basename, url: null, saved: false });
        continue;
      }

      // Save the image as a custom image
      const destFilename = `${nameWithoutExt}_${Date.now()}${ext}`;
      const destPath = path.join(destDir, destFilename);
      await fs.copyFile(filePath, destPath);

      const customImageUrl = `/custom-images/${id}/${destFilename}`;

      // Update pageMeta
      const existing = project.pageMeta[matchedUrl] ?? {
        title: "",
        description: "",
        screenshotPath: "",
      };
      project.pageMeta[matchedUrl] = { ...existing, customImageUrl };

      results.push({ filename: basename, url: matchedUrl, saved: true });
    }

    const saved = results.filter((r) => r.saved).length;
    const unmatched = results.filter((r) => !r.saved).map((r) => r.filename);

    if (saved > 0) {
      project.updatedAt = new Date().toISOString();
      await saveProject(project);
    }

    return NextResponse.json(
      {
        ok: true,
        total: imageFiles.length,
        saved,
        unmatched,
        results,
      },
      { status: 200 }
    );
  } finally {
    // Clean up temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
