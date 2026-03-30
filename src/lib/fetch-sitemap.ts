const UA = "Mozilla/5.0 (compatible; VisualSitemapBot/1.0)";
const TIMEOUT = 10000;

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  // Remove trailing slash
  return url.replace(/\/$/, "");
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function tryFetch(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim().startsWith("<?xml") && !text.trim().startsWith("<urlset") && !text.trim().startsWith("<sitemapindex")) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

async function findInRobotsTxt(origin: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`${origin}/robots.txt`);
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/^sitemap:\s*(.+)$/im);
    if (match) {
      return match[1].trim();
    }
    return null;
  } catch {
    return null;
  }
}

export interface FetchSitemapResult {
  xml: string;
  sourceUrl: string;
  urlCount?: number;
}

export async function fetchSitemapFromUrl(
  inputUrl: string
): Promise<FetchSitemapResult> {
  const normalized = normalizeUrl(inputUrl);
  let origin: string;
  try {
    origin = new URL(normalized).origin;
  } catch {
    throw new Error(`URL inválida: ${inputUrl}`);
  }

  // 1. Try /sitemap.xml
  const sitemapXml = await tryFetch(`${origin}/sitemap.xml`);
  if (sitemapXml) {
    return { xml: sitemapXml, sourceUrl: `${origin}/sitemap.xml` };
  }

  // 2. Try /sitemap_index.xml
  const sitemapIndexXml = await tryFetch(`${origin}/sitemap_index.xml`);
  if (sitemapIndexXml) {
    return { xml: sitemapIndexXml, sourceUrl: `${origin}/sitemap_index.xml` };
  }

  // 3. Check robots.txt for Sitemap: directive
  const robotsSitemapUrl = await findInRobotsTxt(origin);
  if (robotsSitemapUrl) {
    const robotsSitemap = await tryFetch(robotsSitemapUrl);
    if (robotsSitemap) {
      return { xml: robotsSitemap, sourceUrl: robotsSitemapUrl };
    }
  }

  throw new Error(
    `No se encontró ningún sitemap en ${origin}. Prueba subiendo el XML directamente.`
  );
}
