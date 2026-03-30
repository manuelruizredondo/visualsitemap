import { XMLParser } from "fast-xml-parser";
import type { TreeNode } from "@/types";

export function parseSitemapXml(xml: string): string[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });
  const parsed = parser.parse(xml);

  // Handle sitemap index (references to other sitemaps)
  if (parsed.sitemapindex) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];
    return sitemaps.map((s: { loc: string }) => s.loc).filter(Boolean);
  }

  // Handle regular sitemap
  if (parsed.urlset) {
    const urls = Array.isArray(parsed.urlset.url)
      ? parsed.urlset.url
      : [parsed.urlset.url];
    return urls.map((u: { loc: string }) => u.loc).filter(Boolean);
  }

  return [];
}

export function buildTree(urls: string[]): TreeNode {
  if (urls.length === 0) {
    return {
      id: "root",
      label: "Vacío",
      url: "",
      fullPath: "/",
      children: [],
      depth: 0,
    };
  }

  // Extract base URL from first URL
  const firstUrl = new URL(urls[0]);
  const baseUrl = `${firstUrl.protocol}//${firstUrl.host}`;

  const root: TreeNode = {
    id: "root",
    label: firstUrl.host,
    url: baseUrl,
    fullPath: "/",
    children: [],
    depth: 0,
  };

  // Map to track nodes by path for quick lookup
  const nodeMap = new Map<string, TreeNode>();
  nodeMap.set("/", root);

  let nodeCounter = 0;

  for (const urlStr of urls) {
    try {
      const url = new URL(urlStr);
      let pathname = url.pathname;

      // Normalize: remove trailing slash (except root)
      if (pathname.length > 1 && pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }

      // Skip root - already created
      if (pathname === "/" || pathname === "") {
        root.url = urlStr;
        continue;
      }

      const segments = pathname.split("/").filter(Boolean);
      let currentPath = "";
      let parentNode = root;

      for (let i = 0; i < segments.length; i++) {
        currentPath += "/" + segments[i];
        const isLastSegment = i === segments.length - 1;

        let existingNode = nodeMap.get(currentPath);

        if (!existingNode) {
          nodeCounter++;
          existingNode = {
            id: `node-${nodeCounter}`,
            label: decodeURIComponent(segments[i]).replace(/-/g, " "),
            url: isLastSegment ? urlStr : "",
            fullPath: currentPath,
            children: [],
            depth: i + 1,
          };
          nodeMap.set(currentPath, existingNode);
          parentNode.children.push(existingNode);
        } else if (isLastSegment && !existingNode.url) {
          // Node exists as virtual, now we have the actual URL
          existingNode.url = urlStr;
        }

        parentNode = existingNode;
      }
    } catch {
      // Skip invalid URLs
      continue;
    }
  }

  return root;
}
