import fs from "fs/promises";
import path from "path";
import type { Project, Annotation, AnnotationType, PageMeta, CustomNode } from "@/types";
import { v4 as uuidv4 } from "uuid";

const DATA_DIR = path.join(process.cwd(), "data", "projects");
const SCREENSHOTS_DIR = path.join(process.cwd(), "public", "screenshots");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

function migrateProject(raw: Record<string, unknown>): Project {
  const p = raw as unknown as Project;
  return {
    ...p,
    pageMeta: p.pageMeta ?? {},
    annotations: p.annotations ?? {},
    customNodes: p.customNodes ?? [],
    isFavorite: p.isFavorite ?? false,
    isArchived: p.isArchived ?? false,
    tags: p.tags ?? [],
    pageTags: p.pageTags ?? {},
    pageNames: p.pageNames ?? {},
    pageDrawings: p.pageDrawings ?? {},
  };
}

export async function listProjects(): Promise<Omit<Project, "tree">[]> {
  await ensureDir();
  let files: string[];
  try {
    files = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }

  const projects = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const raw = await fs.readFile(path.join(DATA_DIR, f), "utf-8");
        const project = migrateProject(JSON.parse(raw) as Record<string, unknown>);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tree: _, ...meta } = project;
        return meta;
      })
  );

  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return migrateProject(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function saveProject(project: Project): Promise<void> {
  await ensureDir();
  await fs.writeFile(
    path.join(DATA_DIR, `${project.id}.json`),
    JSON.stringify(project, null, 2),
    "utf-8"
  );
}

export async function deleteProject(id: string): Promise<void> {
  const project = await getProject(id);
  if (project?.screenshotJobId) {
    try {
      await fs.rm(path.join(SCREENSHOTS_DIR, project.screenshotJobId), {
        recursive: true,
        force: true,
      });
    } catch {}
  }
  try {
    await fs.unlink(path.join(DATA_DIR, `${id}.json`));
  } catch {}
}

export async function updateProjectThumbnail(id: string, thumbnailUrl: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  project.thumbnailUrl = thumbnailUrl;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function updatePageMeta(id: string, pageMeta: Record<string, PageMeta>): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  project.pageMeta = { ...project.pageMeta, ...pageMeta };
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function updateCustomImage(id: string, key: string, customImageUrl: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  if (!project.pageMeta[key]) {
    project.pageMeta[key] = { title: "", description: "", screenshotPath: "", customImageUrl };
  } else {
    project.pageMeta[key].customImageUrl = customImageUrl;
  }
  // Also update custom node if applicable
  const customNode = project.customNodes.find((n) => n.id === key);
  if (customNode) {
    // stored in pageMeta[key] above
  }
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function addAnnotation(
  projectId: string, url: string, text: string, type: AnnotationType
): Promise<Annotation> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Proyecto no encontrado");

  const annotation: Annotation = { id: uuidv4(), text, type, createdAt: new Date().toISOString() };
  if (!project.annotations[url]) project.annotations[url] = [];
  project.annotations[url].push(annotation);
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return annotation;
}

export async function deleteAnnotation(projectId: string, url: string, annotationId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;
  if (project.annotations[url]) {
    project.annotations[url] = project.annotations[url].filter((a) => a.id !== annotationId);
  }
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function addCustomNode(projectId: string, node: CustomNode): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Proyecto no encontrado");
  project.customNodes.push(node);
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function updateCustomNodeLabel(projectId: string, nodeId: string, label: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;
  const node = project.customNodes.find((n) => n.id === nodeId);
  if (node) node.label = label;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}

export async function updateCustomNodePosition(
  projectId: string, nodeId: string, position: { x: number; y: number }
): Promise<void> {
  const project = await getProject(projectId);
  if (!project) return;
  const node = project.customNodes.find((n) => n.id === nodeId);
  if (node) node.position = position;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
}
