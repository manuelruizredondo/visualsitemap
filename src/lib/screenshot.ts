import puppeteer, { type Browser, type Page } from "puppeteer";
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

/**
 * Navigate to a URL with progressive fallback:
 * networkidle2 → load + wait → domcontentloaded + wait
 */
async function navigatePage(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
    return;
  } catch {
    // networkidle2 timed out (common on pages with animations / websockets)
  }

  try {
    await page.goto(url, { waitUntil: "load", timeout: 15000 });
    await new Promise((r) => setTimeout(r, 2500));
    return;
  } catch {
    // load also timed out
  }

  // Last resort
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
  await new Promise((r) => setTimeout(r, 4000));
}

/**
 * Scroll through the entire page using wheel events.
 * Locomotive Scroll, Lenis, GSAP ScrollTrigger, and IntersectionObserver-based
 * animations all respond to native wheel events, which this dispatches.
 */
async function autoScrollPage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    // Get an estimate of total scroll distance.
    // For Locomotive Scroll the real height is in its scroll container.
    // For Lenis the wrapper is [data-lenis-wrapper] or the Lenis instance
    // attaches to <html> with class "lenis".
    const locoContainer = document.querySelector("[data-scroll-container]");
    const lenisWrapper =
      document.querySelector("[data-lenis-wrapper]") ||
      document.querySelector(".lenis-wrapper");
    const lenisContent =
      document.querySelector("[data-lenis-content]") ||
      document.querySelector(".lenis-content");

    const estimatedHeight = locoContainer
      ? (locoContainer as HTMLElement).scrollHeight
      : lenisContent
        ? (lenisContent as HTMLElement).scrollHeight
        : lenisWrapper
          ? (lenisWrapper as HTMLElement).scrollHeight
          : Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);

    const steps = Math.ceil(estimatedHeight / 600) + 5; // ~600px per step
    const delay = 250; // ms between steps — enough for Locomotive to update

    for (let i = 0; i <= steps; i++) {
      // Dispatch a wheel event — Locomotive intercepts these to drive its scroll
      window.dispatchEvent(
        new WheelEvent("wheel", {
          deltaY: 600,
          deltaMode: 0,
          bubbles: true,
          cancelable: true,
        })
      );
      // Also move the native scroll position (for non-Locomotive pages)
      window.scrollBy(0, 600);
      await new Promise((r) => setTimeout(r, delay));
    }

    // Give animations time to settle at the bottom
    await new Promise((r) => setTimeout(r, 800));
  });

  // Extra buffer outside evaluate for image decoding / CSS transitions
  await new Promise((r) => setTimeout(r, 1000));
}

/**
 * Neutralise Locomotive Scroll, Lenis, and similar smooth-scroll libraries
 * so that Puppeteer can capture the full page height.
 *
 * Locomotive sets `overflow: hidden` on <html> and <body> via the class
 * `has-scroll-smooth`, and applies `transform: translate3d(0, -Ypx, 0)` to
 * the scroll-content wrapper.
 *
 * Lenis sets `overflow: hidden` on <html> via the class `lenis` /
 * `lenis-smooth`, and uses `transform: translateY(-Ypx)` on
 * [data-lenis-content] or the first child of [data-lenis-wrapper].
 *
 * Removing the classes + resetting transforms is cleaner than fighting
 * specificity with !important.
 */
async function prepareForScreenshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    // ── 1. Remove Locomotive Scroll classes ──────────────────────────
    const locoClasses = [
      "has-scroll-smooth",
      "has-scroll-init",
      "has-scroll-scrolling",
      "has-scroll-dragging",
    ];
    locoClasses.forEach((cls) => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });

    // ── 2. Remove Lenis classes ─────────────────────────────────────
    const lenisClasses = [
      "lenis",
      "lenis-smooth",
      "lenis-scrolling",
      "lenis-stopped",
    ];
    lenisClasses.forEach((cls) => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });

    // ── 3. Try to destroy the Lenis instance so it stops fighting us ─
    try {
      // Lenis is often stored on window or as a global
      const win = window as unknown as Record<string, unknown>;
      const lenisInstance =
        win.lenis || win.Lenis || win.__lenis || win.lenisInstance;
      if (lenisInstance && typeof (lenisInstance as any).destroy === "function") {
        (lenisInstance as any).destroy();
      }
    } catch {
      // Lenis not found as a global — that's fine
    }

    // ── 4. Reset Locomotive transforms ──────────────────────────────
    const locoContent =
      document.querySelector("[data-scroll-content]") ||
      document.querySelector("[data-scroll-container] > *");
    if (locoContent) {
      (locoContent as HTMLElement).style.transform = "none";
      (locoContent as HTMLElement).style.webkitTransform = "none";
      (locoContent as HTMLElement).style.willChange = "auto";
    }

    // ── 5. Reset Lenis transforms ───────────────────────────────────
    const lenisContent =
      document.querySelector("[data-lenis-content]") ||
      document.querySelector(".lenis-content") ||
      document.querySelector("[data-lenis-wrapper] > *");
    if (lenisContent) {
      (lenisContent as HTMLElement).style.transform = "none";
      (lenisContent as HTMLElement).style.webkitTransform = "none";
      (lenisContent as HTMLElement).style.willChange = "auto";
    }

    const lenisWrapper =
      document.querySelector("[data-lenis-wrapper]") ||
      document.querySelector(".lenis-wrapper");
    if (lenisWrapper) {
      (lenisWrapper as HTMLElement).style.overflow = "visible";
      (lenisWrapper as HTMLElement).style.height = "auto";
      (lenisWrapper as HTMLElement).style.maxHeight = "none";
    }

    // ── 6. Force overflow visible on key elements ───────────────────
    const makeVisible = (el: Element | null) => {
      if (!el) return;
      const h = el as HTMLElement;
      h.style.overflow = "visible";
      h.style.height = "auto";
      h.style.maxHeight = "none";
    };
    makeVisible(document.documentElement);
    makeVisible(document.body);
    makeVisible(document.querySelector("[data-scroll-container]"));

    // ── 7. Scroll native window back to top ─────────────────────────
    window.scrollTo(0, 0);
  });

  // Wait for the browser to reflow after the CSS changes
  await new Promise((r) => setTimeout(r, 600));
}

/** Extract SEO data from the current page */
async function extractSeoData(page: Page) {
  return page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll("h1")).map(
      (el) => el.textContent?.trim() || ""
    );
    const h2Count = document.querySelectorAll("h2").length;
    const h3Count = document.querySelectorAll("h3").length;

    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const canonical = document.querySelector('link[rel="canonical"]');

    const images = document.querySelectorAll("img");
    const imgWithoutAlt = Array.from(images).filter(
      (img) => !img.alt || img.alt.trim() === ""
    ).length;

    const links = document.querySelectorAll("a[href]");
    let internalLinks = 0;
    let externalLinks = 0;
    links.forEach((link) => {
      try {
        const href = (link as HTMLAnchorElement).href;
        if (href.startsWith(window.location.origin) || href.startsWith("/")) {
          internalLinks++;
        } else if (href.startsWith("http")) {
          externalLinks++;
        }
      } catch {}
    });

    const bodyText = document.body?.innerText || "";
    const wordCount = bodyText.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      h1: h1s,
      h2Count,
      h3Count,
      hasOgTitle: !!ogTitle?.getAttribute("content"),
      hasOgDescription: !!ogDesc?.getAttribute("content"),
      hasOgImage: !!ogImage?.getAttribute("content"),
      hasCanonical: !!canonical,
      canonicalUrl: canonical?.getAttribute("href") || "",
      imgWithoutAlt,
      totalImages: images.length,
      internalLinks,
      externalLinks,
      wordCount,
    };
  });
}

/** Capture a single page: navigate → scroll → neutralise Loco → screenshot */
async function capturePage(
  page: Page,
  url: string,
  screenshotDir: string,
  dirName: string
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = {
    url,
    screenshotPath: "",
    title: "",
    description: "",
  };

  try {
    // Use a wide viewport so CSS breakpoints don't hide content
    await page.setViewport({ width: 1440, height: 900 });

    // Navigate with progressive fallback
    await navigatePage(page, url);

    // Scroll through the page to trigger lazy-loaded content
    await autoScrollPage(page);

    // Extract SEO data while everything is still loaded
    const title = await page.title();
    const description = await page.evaluate(() => {
      const el =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      return el?.getAttribute("content") || "";
    });
    const seoData = await extractSeoData(page);

    // Neutralise Locomotive Scroll / smooth-scroll libs
    await prepareForScreenshot(page);

    // Measure the real content height after reflow
    const fullHeight = await page.evaluate(() => {
      const locoContent =
        document.querySelector("[data-scroll-content]") ||
        document.querySelector("[data-scroll-container] > *");
      const lenisContent =
        document.querySelector("[data-lenis-content]") ||
        document.querySelector(".lenis-content") ||
        document.querySelector("[data-lenis-wrapper] > *");

      return Math.max(
        document.body.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.scrollHeight,
        (locoContent as HTMLElement)?.scrollHeight ?? 0,
        (locoContent as HTMLElement)?.offsetHeight ?? 0,
        (lenisContent as HTMLElement)?.scrollHeight ?? 0,
        (lenisContent as HTMLElement)?.offsetHeight ?? 0,
        900 // minimum fallback
      );
    });

    // Resize viewport to exact content height (Puppeteer cap: ~16384px)
    const captureHeight = Math.min(Math.max(fullHeight, 900), 16000);
    await page.setViewport({ width: 1440, height: captureHeight });
    await new Promise((r) => setTimeout(r, 300));

    const slug = urlToSlug(url);
    const filename = `${slug}.jpg`;
    const filepath = path.join(screenshotDir, filename);

    await page.screenshot({
      path: filepath,
      type: "jpeg",
      quality: 80,
      fullPage: true,
    });

    result.screenshotPath = `/screenshots/${dirName}/${filename}`;
    result.title = title;
    result.description = description;
    result.seo = {
      titleLength: title.length,
      descriptionLength: description.length,
      ...seoData,
    };
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Error desconocido";
    result.title = url;
  }

  return result;
}

/** Recapture a single URL and return the updated result */
export async function processSingleScreenshot(
  jobDir: string,
  url: string
): Promise<ScreenshotResult> {
  const screenshotDir = path.join(
    process.cwd(),
    "public",
    "screenshots",
    jobDir
  );
  await fs.mkdir(screenshotDir, { recursive: true });

  let browser: Browser | null = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });

    const page = await browser.newPage();
    const result = await capturePage(page, url, screenshotDir, jobDir);
    await page.close();
    return result;
  } catch (err) {
    return {
      url,
      screenshotPath: "",
      title: url,
      description: "",
      error: err instanceof Error ? err.message : "Error desconocido",
    };
  } finally {
    if (browser) await browser.close();
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
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });

    for (const url of urls) {
      try {
        const page = await browser.newPage();
        const result = await capturePage(page, url, screenshotDir, jobId);
        await page.close();
        job.results.push(result);
      } catch (err) {
        job.results.push({
          url,
          screenshotPath: "",
          title: url,
          description: "",
          error: err instanceof Error ? err.message : "Error desconocido",
        });
      }
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
