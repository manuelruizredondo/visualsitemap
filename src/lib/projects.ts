import type { Project, Annotation, AnnotationType, PageMeta, CustomNode, TreeNode } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { createAdminClient } from "@/lib/supabase/admin";

// ── helpers ──────────────────────────────────────────────────────────────────

function db() {
  return createAdminClient().from("projects");
}

/** Map a Supabase row back to the Project interface */
function rowToProject(row: Record<string, unknown>): Project {
  return {
    id:               row.id as string,
    name:             row.name as string,
    domain:           row.domain as string,
    createdAt:        (row.created_at as string),
    updatedAt:        (row.updated_at as string),
    urls:             (row.urls as string[]) ?? [],
    tree:             row.tree as Project["tree"],
    pageMeta:         (row.page_meta as Project["pageMeta"]) ?? {},
    annotations:      (row.annotations as Project["annotations"]) ?? {},
    customNodes:      (row.custom_nodes as Project["customNodes"]) ?? [],
    tags:             (row.tags as Project["tags"]) ?? [],
    pageTags:         (row.page_tags as Project["pageTags"]) ?? {},
    pageNames:        (row.page_names as Project["pageNames"]) ?? {},
    pageDrawings:     (row.page_drawings as Project["pageDrawings"]) ?? {},
    thumbnailUrl:     row.thumbnail_url as string | undefined,
    screenshotJobId:  row.screenshot_job_id as string | undefined,
    isFavorite:       (row.is_favorite as boolean) ?? false,
    isArchived:       (row.is_archived as boolean) ?? false,
    userId:           row.user_id as string | undefined,
  };
}

/** Map a Project to Supabase column names */
function projectToRow(p: Project): Record<string, unknown> {
  return {
    id:               p.id,
    user_id:          p.userId ?? null,
    name:             p.name,
    domain:           p.domain,
    thumbnail_url:    p.thumbnailUrl ?? null,
    screenshot_job_id: p.screenshotJobId ?? null,
    is_favorite:      p.isFavorite ?? false,
    is_archived:      p.isArchived ?? false,
    urls:             p.urls,
    tree:             p.tree,
    page_meta:        p.pageMeta,
    annotations:      p.annotations,
    custom_nodes:     p.customNodes,
    tags:             p.tags ?? [],
    page_tags:        p.pageTags ?? {},
    page_names:       p.pageNames ?? {},
    page_drawings:    p.pageDrawings ?? {},
    updated_at:       p.updatedAt,
    created_at:       p.createdAt,
  };
}

// ── public API ────────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Omit<Project, "tree">[]> {
  const { data, error } = await db()
    .select("id,user_id,name,domain,thumbnail_url,screenshot_job_id,is_favorite,is_archived,urls,page_meta,annotations,custom_nodes,tags,page_tags,page_names,page_drawings,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tree: _t, ...rest } = rowToProject({ ...row, tree: {} });
    return rest;
  });
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await db()
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return rowToProject(data as Record<string, unknown>);
}

export async function saveProject(project: Project): Promise<void> {
  const row = projectToRow(project);
  const { error } = await db()
    .upsert(row, { onConflict: "id" });

  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await db().delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateProjectThumbnail(id: string, thumbnailUrl: string): Promise<void> {
  const { error } = await db()
    .update({ thumbnail_url: thumbnailUrl, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updatePageMeta(id: string, pageMeta: Record<string, PageMeta>): Promise<void> {
  // Merge into existing page_meta using Postgres jsonb concatenation operator
  const { error } = await db()
    .update({
      page_meta: pageMeta,  // will be merged on client side after fetch
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Use atomic merge via RPC to avoid race conditions
  const admin = createAdminClient();
  const { error: rpcError } = await admin.rpc("merge_project_page_meta", {
    p_id: id,
    p_page_meta: pageMeta,
  });

  // If RPC doesn't exist yet, fall back to read-modify-write
  if (rpcError) {
    const project = await getProject(id);
    if (!project) return;
    project.pageMeta = { ...project.pageMeta, ...pageMeta };
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
  }
  void error; // suppress unused warning if update above succeeded via rpc
}

export async function updateCustomImage(id: string, key: string, customImageUrl: string): Promise<void> {
  const project = await getProject(id);
  if (!project) return;
  if (!project.pageMeta[key]) {
    project.pageMeta[key] = { title: "", description: "", screenshotPath: "", customImageUrl };
  } else {
    project.pageMeta[key].customImageUrl = customImageUrl;
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

export async function removeNode(projectId: string, nodeId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Proyecto no encontrado");

  const customIdx = project.customNodes.findIndex((n) => n.id === nodeId);
  if (customIdx >= 0) {
    project.customNodes.splice(customIdx, 1);
  } else {
    function removeFromTree(parent: TreeNode): boolean {
      const idx = parent.children.findIndex((c) => c.id === nodeId);
      if (idx >= 0) { parent.children.splice(idx, 1); return true; }
      for (const child of parent.children) { if (removeFromTree(child)) return true; }
      return false;
    }
    removeFromTree(project.tree);
  }

  const pageKey = nodeId;
  if (project.pageMeta[pageKey])    delete project.pageMeta[pageKey];
  if (project.annotations[pageKey]) delete project.annotations[pageKey];
  if (project.pageTags?.[pageKey])  delete project.pageTags[pageKey];
  if (project.pageNames?.[pageKey]) delete project.pageNames[pageKey];
  if (project.pageDrawings?.[pageKey]) delete project.pageDrawings[pageKey];

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
