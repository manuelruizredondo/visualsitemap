import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";
import fs from "fs/promises";
import type { ScreenshotResult, ScreenshotJob, A11yData } from "@/types";

/** Launch Puppeteer with a clear error when Chrome is missing. */
async function launchBrowser(): Promise<Browser> {
  try {
    return await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
      ],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Could not find Chrome") ||
      msg.includes("Could not find Chromium")
    ) {
      throw new Error(
        "Chrome no está instalado para Puppeteer. Ejecuta: npx puppeteer browsers install chrome"
      );
    }
    throw err;
  }
}

// In-memory store for screenshot jobs (attached to globalThis to survive HMR in dev)
const globalJobs = globalThis as unknown as {
  __screenshotJobs?: Map<string, ScreenshotJob>;
};
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
 * Neutralise smooth-scroll libraries (Lenis, Locomotive Scroll) so Puppeteer
 * can take a proper fullPage screenshot.
 *
 * The key problem: these libraries set `overflow: hidden` on <html>/<body>
 * and translate content via CSS transforms, which prevents Puppeteer's
 * `fullPage: true` from seeing the real document height.
 *
 * Strategy: destroy/disable the library, remove its classes, reset transforms,
 * and restore native overflow — then let Puppeteer handle the rest.
 */
async function neutraliseSmoothScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    // ── Lenis ───────────────────────────────────────────────────────
    // 1. Try to destroy the Lenis instance first (stops rAF loop)
    try {
      const win = window as unknown as Record<string, unknown>;
      const candidates = [
        win.lenis,
        win.__lenis,
        win.lenisInstance,
        win.scroll,
        win.smoother,
      ];
      for (const inst of candidates) {
        if (inst && typeof (inst as any).destroy === "function") {
          (inst as any).destroy();
        }
      }
    } catch {
      // No global Lenis instance found — that's fine
    }

    // 2. Remove Lenis classes
    ["lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped"].forEach(
      (cls) => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      }
    );

    // 3. Reset Lenis wrapper/content transforms
    const lenisContent =
      document.querySelector("[data-lenis-content]") ||
      document.querySelector(".lenis-content") ||
      document.querySelector("[data-lenis-wrapper] > *");
    if (lenisContent) {
      const el = lenisContent as HTMLElement;
      el.style.transform = "none";
      el.style.webkitTransform = "none";
      el.style.willChange = "auto";
    }
    const lenisWrapper =
      document.querySelector("[data-lenis-wrapper]") ||
      document.querySelector(".lenis-wrapper");
    if (lenisWrapper) {
      const el = lenisWrapper as HTMLElement;
      el.style.overflow = "visible";
      el.style.height = "auto";
    }

    // ── Locomotive Scroll ───────────────────────────────────────────
    [
      "has-scroll-smooth",
      "has-scroll-init",
      "has-scroll-scrolling",
      "has-scroll-dragging",
    ].forEach((cls) => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });

    const locoContent =
      document.querySelector("[data-scroll-content]") ||
      document.querySelector("[data-scroll-container] > *");
    if (locoContent) {
      const el = locoContent as HTMLElement;
      el.style.transform = "none";
      el.style.webkitTransform = "none";
      el.style.willChange = "auto";
    }
    const locoContainer = document.querySelector("[data-scroll-container]");
    if (locoContainer) {
      (locoContainer as HTMLElement).style.overflow = "visible";
    }

    // ── Generic: ensure html & body allow full-height rendering ─────
    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";

    // Scroll back to top so fullPage captures from the beginning
    window.scrollTo(0, 0);
  });

  // Let the browser reflow
  await new Promise((r) => setTimeout(r, 500));
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
        if (
          href.startsWith(window.location.origin) ||
          href.startsWith("/")
        ) {
          internalLinks++;
        } else if (href.startsWith("http")) {
          externalLinks++;
        }
      } catch {}
    });

    const bodyText = document.body?.innerText || "";
    const wordCount = bodyText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

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

/** Extract accessibility data from the current page */
async function extractA11yData(page: Page): Promise<A11yData> {
  return page.evaluate(() => {
    // ── Images without alt ──────────────────────────────────────────
    const images = document.querySelectorAll("img");
    const imgWithoutAlt = Array.from(images).filter(
      (img) => !img.hasAttribute("alt") || (img.alt.trim() === "" && !img.getAttribute("role"))
    ).length;

    // ── Buttons without accessible label ────────────────────────────
    const buttons = document.querySelectorAll("button, [role='button']");
    const buttonsWithoutLabel = Array.from(buttons).filter((btn) => {
      const text = (btn.textContent || "").trim();
      const ariaLabel = btn.getAttribute("aria-label") || "";
      const ariaLabelledBy = btn.getAttribute("aria-labelledby");
      const title = btn.getAttribute("title") || "";
      if (text || ariaLabel || title) return false;
      if (ariaLabelledBy) {
        const ref = document.getElementById(ariaLabelledBy);
        if (ref && (ref.textContent || "").trim()) return false;
      }
      return true;
    }).length;

    // ── Inputs without label ────────────────────────────────────────
    const inputs = document.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button']), select, textarea"
    );
    const inputsWithoutLabel = Array.from(inputs).filter((input) => {
      const id = input.id;
      if (id && document.querySelector(`label[for='${id}']`)) return false;
      if (input.closest("label")) return false;
      if (input.getAttribute("aria-label") || input.getAttribute("aria-labelledby")) return false;
      if (input.getAttribute("title")) return false;
      return true;
    }).length;

    // ── Links without discernible text ──────────────────────────────
    const links = document.querySelectorAll("a[href]");
    const linksWithoutText = Array.from(links).filter((a) => {
      const text = (a.textContent || "").trim();
      const ariaLabel = a.getAttribute("aria-label") || "";
      const title = a.getAttribute("title") || "";
      const img = a.querySelector("img[alt]");
      return !text && !ariaLabel && !title && !img;
    }).length;

    // ── Missing lang attribute ──────────────────────────────────────
    const missingLang = !document.documentElement.getAttribute("lang");

    // ── Heading order validation ────────────────────────────────────
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const headingSequence = Array.from(headings).map((h) =>
      parseInt(h.tagName.charAt(1), 10)
    );
    let headingOrderValid = true;
    for (let i = 1; i < headingSequence.length; i++) {
      if (headingSequence[i] > headingSequence[i - 1] + 1) {
        headingOrderValid = false;
        break;
      }
    }

    // ── Approximate low-contrast text detection ─────────────────────
    // Checks visible text elements for contrast against their background
    let lowContrastTexts = 0;
    const textEls = document.querySelectorAll(
      "p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, button"
    );
    const sample = Array.from(textEls).slice(0, 200); // limit for performance
    for (const el of sample) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const fgRaw = style.color;
      const bgRaw = style.backgroundColor;
      // Quick luminance check on rgb values
      const parseRgb = (s: string) => {
        const m = s.match(/(\d+)/g);
        return m ? m.map(Number) : null;
      };
      const fg = parseRgb(fgRaw);
      const bg = parseRgb(bgRaw);
      if (fg && bg && bg[3] !== 0) {
        // Relative luminance (simplified sRGB)
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const l1 = lum(fg);
        const l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const fontSize = parseFloat(style.fontSize);
        const isBold = parseInt(style.fontWeight, 10) >= 700;
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
        const minRatio = isLargeText ? 3 : 4.5;
        if (ratio < minRatio) lowContrastTexts++;
      }
    }

    // ── Skip link ───────────────────────────────────────────────────
    const firstLinks = Array.from(document.querySelectorAll("a[href]")).slice(0, 5);
    const missingSkipLink = !firstLinks.some((a) => {
      const href = a.getAttribute("href") || "";
      const text = ((a.textContent || "") + (a.getAttribute("aria-label") || "")).toLowerCase();
      return href.startsWith("#") && (text.includes("skip") || text.includes("saltar") || text.includes("ir al contenido"));
    });

    // ── Landmarks ───────────────────────────────────────────────────
    const missingMainLandmark =
      !document.querySelector("main") && !document.querySelector("[role='main']");
    const missingNavLandmark =
      !document.querySelector("nav") && !document.querySelector("[role='navigation']");

    // ── Autoplaying media ───────────────────────────────────────────
    const autoplaying = document.querySelectorAll(
      "video[autoplay], audio[autoplay]"
    ).length;

    // ── Form autocomplete ───────────────────────────────────────────
    const formFields = document.querySelectorAll(
      "input[type='text'], input[type='email'], input[type='tel'], input[type='password'], input[type='url'], input[type='search'], input:not([type])"
    );
    const formFieldsWithoutAutocomplete = Array.from(formFields).filter(
      (f) => !f.getAttribute("autocomplete")
    ).length;

    return {
      imgWithoutAlt,
      totalImages: images.length,
      buttonsWithoutLabel,
      totalButtons: buttons.length,
      inputsWithoutLabel,
      totalInputs: inputs.length,
      linksWithoutText,
      totalLinks: links.length,
      missingLang,
      headingOrderValid,
      headingSequence,
      lowContrastTexts,
      missingSkipLink,
      missingMainLandmark,
      missingNavLandmark,
      autoplaying,
      totalFormFields: formFields.length,
      formFieldsWithoutAutocomplete,
    };
  });
}

/**
 * Append `capture=1` to a URL so the target site renders in "capture mode"
 * (all content visible, no scroll-dependent animations).
 */
function toCaptureUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("capture", "1");
    return u.toString();
  } catch {
    // If URL parsing fails, fall back to simple concatenation
    return url + (url.includes("?") ? "&" : "?") + "capture=1";
  }
}

/**
 * Capture a single page.
 *
 * Flow: navigate with ?capture=1 → neutralise smooth-scroll (fallback)
 *       → extract SEO → fullPage screenshot.
 *
 * The `capture=1` param tells the target site to render everything visible
 * without depending on scroll or viewport. The neutralise step is kept as
 * a safety net for sites that don't support this param.
 */
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
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate with capture mode enabled
    const captureUrl = toCaptureUrl(url);
    await page.goto(captureUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Safety net: neutralise smooth-scroll libs in case the site
    // doesn't fully support ?capture=1
    await neutraliseSmoothScroll(page);

    // Extract metadata & SEO
    const title = await page.title();
    const description = await page.evaluate(() => {
      const el =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      return el?.getAttribute("content") || "";
    });
    const seoData = await extractSeoData(page);
    const a11yData = await extractA11yData(page);

    // Take the screenshot — fullPage handles height automatically
    const slug = urlToSlug(url);
    const filename = `${slug}.jpg`;
    const filepath = path.join(screenshotDir, filename);

    await page.screenshot({
      path: filepath,
      type: "jpeg",
      quality: 75,
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
    result.a11y = a11yData;
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
    browser = await launchBrowser();

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
    browser = await launchBrowser();

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
