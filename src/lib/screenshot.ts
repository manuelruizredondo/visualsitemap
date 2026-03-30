import puppeteer, { type Browser } from "puppeteer";
import path from "path";
import fs from "fs/promises";
import type { ScreenshotResult, ScreenshotJob } from "@/types";

// In-memory store for screenshot jobs (attached to globalThis to survive HMR in dev)
const globalJobs = globalThis as unknown as { __screenshotJobs?: Map<string, ScreenshotJob> };
if (!globalJobs.__screenshotJobs) {
  globalJobs.__screenshotJobs = new Map<string, ScreenshotJob>();
}
const jobs = globalJobs.__screenshotJobs;

export function getJob(jobId: string): ScreenshotJob | undefined {
  return jobs.get(jobId);
}

export function createJob(jobId: string, urls: string[]): ScreenshotJob {
  const job: ScreenshotJob = {
    jobId,
    status: "processing",
    total: urls.length,
    completed: 0,
    results: [],
  };
  jobs.set(jobId, job);
  return job;
}

function urlToSlug(url: string): string {
  try {
    const u = new URL(url);
    const slug = u.pathname
      .replace(/^\//, "")
      .replace(/\/$/, "")
      .replace(/\//g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    return slug || "index";
  } catch {
    return "unknown";
  }
}

export async function processScreenshots(
  jobId: string,
  urls: string[]
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  const screenshotDir = path.join(
    process.cwd(),
    "public",
    "screenshots",
    jobId
  );
  await fs.mkdir(screenshotDir, { recursive: true });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    for (const url of urls) {
      const result: ScreenshotResult = {
        url,
        screenshotPath: "",
        title: "",
        description: "",
      };

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: 15000,
        });

        const title = await page.title();
        const description = await page.evaluate(() => {
          const el =
            document.querySelector('meta[name="description"]') ||
            document.querySelector('meta[property="og:description"]');
          return el?.getAttribute("content") || "";
        });

        const seoData = await page.evaluate(() => {
          const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent?.trim() || '');
          const h2Count = document.querySelectorAll('h2').length;
          const h3Count = document.querySelectorAll('h3').length;

          const ogTitle = document.querySelector('meta[property="og:title"]');
          const ogDesc = document.querySelector('meta[property="og:description"]');
          const ogImage = document.querySelector('meta[property="og:image"]');
          const canonical = document.querySelector('link[rel="canonical"]');

          const images = document.querySelectorAll('img');
          const imgWithoutAlt = Array.from(images).filter(img => !img.alt || img.alt.trim() === '').length;

          const links = document.querySelectorAll('a[href]');
          let internalLinks = 0;
          let externalLinks = 0;
          links.forEach(link => {
            try {
              const href = (link as HTMLAnchorElement).href;
              if (href.startsWith(window.location.origin) || href.startsWith('/')) {
                internalLinks++;
              } else if (href.startsWith('http')) {
                externalLinks++;
              }
            } catch {}
          });

          const bodyText = document.body?.innerText || '';
          const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

          return {
            h1: h1s,
            h2Count,
            h3Count,
            hasOgTitle: !!ogTitle?.getAttribute('content'),
            hasOgDescription: !!ogDesc?.getAttribute('content'),
            hasOgImage: !!ogImage?.getAttribute('content'),
            hasCanonical: !!canonical,
            canonicalUrl: canonical?.getAttribute('href') || '',
            imgWithoutAlt,
            totalImages: images.length,
            internalLinks,
            externalLinks,
            wordCount,
          };
        });

        const slug = urlToSlug(url);
        const filename = `${slug}.jpg`;
        const filepath = path.join(screenshotDir, filename);

        await page.screenshot({
          path: filepath,
          type: "jpeg",
          quality: 70,
          fullPage: true,
        });

        await page.close();

        result.screenshotPath = `/screenshots/${jobId}/${filename}`;
        result.title = title;
        result.description = description;
        result.seo = {
          titleLength: title.length,
          descriptionLength: description.length,
          ...seoData,
        };
      } catch (err) {
        result.error =
          err instanceof Error ? err.message : "Error desconocido";
        result.title = url;
      }

      job.results.push(result);
      job.completed++;
    }

    job.status = "complete";
  } catch (err) {
    job.status = "error";
    console.error("Screenshot job error:", err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
