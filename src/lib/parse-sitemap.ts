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

// Common ISO 639-1 language codes used as URL prefixes
const LANG_CODES = new Set([
  "aa","ab","af","ak","am","an","ar","as","av","ay","az",
  "ba","be","bg","bh","bi","bm","bn","bo","br","bs",
  "ca","ce","ch","co","cr","cs","cu","cv","cy",
  "da","de","dv","dz",
  "ee","el","en","eo","es","et","eu",
  "fa","ff","fi","fj","fo","fr","fy",
  "ga","gd","gl","gn","gu","gv",
  "ha","he","hi","ho","hr","ht","hu","hy","hz",
  "ia","id","ie","ig","ii","ik","io","is","it","iu",
  "ja","jv",
  "ka","kg","ki","kj","kk","kl","km","kn","ko","kr","ks","ku","kv","kw","ky",
  "la","lb","lg","li","ln","lo","lt","lu","lv",
  "mg","mh","mi","mk","ml","mn","mr","ms","mt","my",
  "na","nb","nd","ne","ng","nl","nn","no","nr","nv","ny",
  "oc","oj","om","or","os",
  "pa","pi","pl","ps","pt",
  "qu",
  "rm","rn","ro","ru","rw",
  "sa","sc","sd","se","sg","si","sk","sl","sm","sn","so","sq","sr","ss","st","su","sv","sw",
  "ta","te","tg","th","ti","tk","tl","tn","to","tr","ts","tt","tw","ty",
  "ug","uk","ur","uz",
  "ve","vi","vo",
  "wa","wo",
  "xh",
  "yi","yo",
  "za","zh","zu",
  // Common extended codes
  "pt-br","pt-pt","zh-cn","zh-tw","en-us","en-gb","es-es","es-mx","fr-fr","fr-ca","de-de","de-at",
]);

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

  // First pass: collect all first-level segments to detect multi-language sites
  const firstSegments = new Set<string>();
  for (const urlStr of urls) {
    try {
      const url = new URL(urlStr);
      const segments = url.pathname.split("/").filter(Boolean);
      if (segments.length > 0) {
        firstSegments.add(segments[0].toLowerCase());
      }
    } catch { continue; }
  }

  // It's multi-language if 2+ first-level segments are language codes
  const detectedLangs = [...firstSegments].filter((s) => LANG_CODES.has(s));
  const isMultilang = detectedLangs.length >= 2;

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
        const isLangSegment = isMultilang && i === 0 && LANG_CODES.has(segments[i].toLowerCase());

        let existingNode = nodeMap.get(currentPath);

        if (!existingNode) {
          nodeCounter++;
          existingNode = {
            id: `node-${nodeCounter}`,
            label: isLangSegment
              ? segments[i].toUpperCase()
              : decodeURIComponent(segments[i]).replace(/-/g, " "),
            url: isLastSegment ? urlStr : "",
            fullPath: currentPath,
            children: [],
            depth: i + 1,
            isLanguage: isLangSegment || undefined,
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
