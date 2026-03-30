export interface TreeNode {
  id: string;
  label: string;
  url: string;
  fullPath: string;
  children: TreeNode[];
  depth: number;
}

export interface ParsedSitemap {
  urls: string[];
  tree: TreeNode;
  totalPages: number;
}

export interface SeoData {
  titleLength: number;
  descriptionLength: number;
  h1: string[];
  h2Count: number;
  h3Count: number;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasCanonical: boolean;
  canonicalUrl: string;
  imgWithoutAlt: number;
  totalImages: number;
  internalLinks: number;
  externalLinks: number;
  wordCount: number;
}

export interface ScreenshotResult {
  url: string;
  screenshotPath: string;
  title: string;
  description: string;
  error?: string;
  seo?: SeoData;
}

export interface ScreenshotJob {
  jobId: string;
  status: "processing" | "complete" | "error";
  total: number;
  completed: number;
  results: ScreenshotResult[];
}

export type AnnotationType = "error" | "mejora" | "nota";

export interface Annotation {
  id: string;
  text: string;
  type: AnnotationType;
  createdAt: string;
}

export interface PageMeta {
  title: string;
  description: string;
  screenshotPath: string;
  customImageUrl?: string;
  seo?: SeoData;
}

/** A manually created node (not from sitemap XML) */
export interface CustomNode {
  id: string;
  label: string;
  parentNodeId: string;
  position: { x: number; y: number };
}

export interface Tag {
  id: string;
  name: string;
  color: string; // hex color like "#ef4444"
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  urls: string[];
  tree: TreeNode;
  screenshotJobId?: string;
  thumbnailUrl?: string;
  pageMeta: Record<string, PageMeta>;        // keyed by url (or nodeId for custom nodes)
  annotations: Record<string, Annotation[]>; // keyed by url (or nodeId for custom nodes)
  customNodes: CustomNode[];
  userId?: string;                           // Supabase user ID (optional for backward compat)
  isFavorite?: boolean;                      // Whether the project is marked as favorite
  isArchived?: boolean;                      // Whether the project is archived
  tags?: Tag[];                              // available tags for this project
  pageTags?: Record<string, string[]>;       // maps page key (url or nodeId) to array of tag IDs
  pageNames?: Record<string, string>;        // custom display names for pages (overrides auto-detected title)
  pageDrawings?: Record<string, string>;     // drawing overlay data URLs (transparent PNGs) keyed by page key
}
