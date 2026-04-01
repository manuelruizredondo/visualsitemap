/**
 * screenshot.ts — Vercel-compatible screenshot engine
 *
 * Production:  @sparticuz/chromium + puppeteer-core, uploads to Supabase Storage,
 *              job state persisted in the `screenshot_jobs` Supabase table.
 *
 * Development: falls back to the full `puppeteer` devDependency (local Chrome).
 */

import type { Browser, Page } from "puppeteer-core";
import type { ScreenshotResult, A11yData } from "@/types";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Browser ───────────────────────────────────────────────────────────────────

async function launchBrowser(): Promise<Browser> {
  if (process.env.NODE_ENV === "development") {
    // Local dev: use full puppeteer (Chrome managed by puppeteer)
    const { default: puppeteer } = await import("puppeteer" as string) as {
      default: { launch: (opts: object) => Promise<Browser> };
    };
    return puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  // Production (Vercel / Lambda): use @sparticuz/chromium + puppeteer-core
  const { default: chromium } = await import("@sparticuz/chromium");
  const { default: puppeteer } = await import("puppeteer-core");

  return puppeteer.launch({
    args: [
      ...chromium.args,
      "--single-process",
      "--no-zygote",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
    ],
    defaultViewport: { width: 1280, height: 800 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    protocolTimeout: 20_000,
  });
}

// ── Supabase Storage upload ───────────────────────────────────────────────────

async function uploadToStorage(
  buffer: Buffer,
  jobId: string,
  filename: string
): Promise<string> {
  const admin = createAdminClient();
  const storagePath = `${jobId}/${filename}`;

  const { error } = await admin.storage
    .from("screenshots")
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  return admin.storage.from("screenshots").getPublicUrl(storagePath).data.publicUrl;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

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

function toCaptureUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("capture", "1");
    return u.toString();
  } catch {
    return url + (url.includes("?") ? "&" : "?") + "capture=1";
  }
}

// ── Smooth-scroll neutraliser ─────────────────────────────────────────────────

async function neutraliseSmoothScroll(page: Page): Promise<void> {
  await page.evaluate(() => {
    try {
      const win = window as unknown as Record<string, unknown>;
      for (const inst of [win.lenis, win.__lenis, win.lenisInstance, win.scroll, win.smoother]) {
        if (inst && typeof (inst as { destroy?: () => void }).destroy === "function") {
          (inst as { destroy: () => void }).destroy();
        }
      }
    } catch { /* no lenis instance */ }

    ["lenis", "lenis-smooth", "lenis-scrolling", "lenis-stopped"].forEach((cls) => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    });

    const lenisContent =
      document.querySelector("[data-lenis-content]") ||
      document.querySelector(".lenis-content") ||
      document.querySelector("[data-lenis-wrapper] > *");
    if (lenisContent) {
      (lenisContent as HTMLElement).style.cssText += ";transform:none;will-change:auto";
    }
    const lenisWrapper =
      document.querySelector("[data-lenis-wrapper]") ||
      document.querySelector(".lenis-wrapper");
    if (lenisWrapper) {
      (lenisWrapper as HTMLElement).style.cssText += ";overflow:visible;height:auto";
    }

    ["has-scroll-smooth", "has-scroll-init", "has-scroll-scrolling", "has-scroll-dragging"].forEach(
      (cls) => {
        document.documentElement.classList.remove(cls);
        document.body.classList.remove(cls);
      }
    );

    const locoContent =
      document.querySelector("[data-scroll-content]") ||
      document.querySelector("[data-scroll-container] > *");
    if (locoContent) {
      (locoContent as HTMLElement).style.cssText += ";transform:none;will-change:auto";
    }
    const locoContainer = document.querySelector("[data-scroll-container]");
    if (locoContainer) {
      (locoContainer as HTMLElement).style.overflow = "visible";
    }

    document.documentElement.style.overflow = "visible";
    document.body.style.overflow = "visible";
    window.scrollTo(0, 0);
  });

  await new Promise((r) => setTimeout(r, 200));
}

// ── SEO extraction ────────────────────────────────────────────────────────────

async function extractSeoData(page: Page) {
  return page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll("h1")).map((el) => el.textContent?.trim() || "");
    const h2Count = document.querySelectorAll("h2").length;
    const h3Count = document.querySelectorAll("h3").length;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDesc = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const canonical = document.querySelector('link[rel="canonical"]');
    const images = document.querySelectorAll("img");
    const imgWithoutAlt = Array.from(images).filter((img) => !img.alt || img.alt.trim() === "").length;
    const links = document.querySelectorAll("a[href]");
    let internalLinks = 0, externalLinks = 0;
    links.forEach((link) => {
      try {
        const href = (link as HTMLAnchorElement).href;
        if (href.startsWith(window.location.origin) || href.startsWith("/")) internalLinks++;
        else if (href.startsWith("http")) externalLinks++;
      } catch { /* ignore */ }
    });
    const wordCount = (document.body?.innerText || "").split(/\s+/).filter((w) => w.length > 0).length;
    return {
      h1: h1s, h2Count, h3Count,
      hasOgTitle: !!ogTitle?.getAttribute("content"),
      hasOgDescription: !!ogDesc?.getAttribute("content"),
      hasOgImage: !!ogImage?.getAttribute("content"),
      hasCanonical: !!canonical,
      canonicalUrl: canonical?.getAttribute("href") || "",
      imgWithoutAlt, totalImages: images.length,
      internalLinks, externalLinks, wordCount,
    };
  });
}

// ── A11y extraction ───────────────────────────────────────────────────────────

async function extractA11yData(page: Page): Promise<A11yData> {
  return page.evaluate(() => {
    const images = document.querySelectorAll("img");
    const imgWithoutAlt = Array.from(images).filter(
      (img) => !img.hasAttribute("alt") || (img.alt.trim() === "" && !img.getAttribute("role"))
    ).length;

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

    const links = document.querySelectorAll("a[href]");
    const linksWithoutText = Array.from(links).filter((a) => {
      const text = (a.textContent || "").trim();
      const ariaLabel = a.getAttribute("aria-label") || "";
      const title = a.getAttribute("title") || "";
      const img = a.querySelector("img[alt]");
      return !text && !ariaLabel && !title && !img;
    }).length;

    const missingLang = !document.documentElement.getAttribute("lang");

    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    const headingSequence = Array.from(headings).map((h) => parseInt(h.tagName.charAt(1), 10));
    let headingOrderValid = true;
    for (let i = 1; i < headingSequence.length; i++) {
      if (headingSequence[i] > headingSequence[i - 1] + 1) { headingOrderValid = false; break; }
    }

    let lowContrastTexts = 0;
    const textEls = document.querySelectorAll("p, span, a, li, td, th, label, h1, h2, h3, h4, h5, h6, button");
    for (const el of Array.from(textEls).slice(0, 200)) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const parseRgb = (s: string) => { const m = s.match(/(\d+)/g); return m ? m.map(Number) : null; };
      const fg = parseRgb(style.color);
      const bg = parseRgb(style.backgroundColor);
      if (fg && bg && bg[3] !== 0) {
        const lum = (rgb: number[]) => {
          const [r, g, b] = rgb.map((c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05);
        const fontSize = parseFloat(style.fontSize);
        const isBold = parseInt(style.fontWeight, 10) >= 700;
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && isBold);
        if (ratio < (isLargeText ? 3 : 4.5)) lowContrastTexts++;
      }
    }

    const firstLinks = Array.from(document.querySelectorAll("a[href]")).slice(0, 5);
    const missingSkipLink = !firstLinks.some((a) => {
      const href = a.getAttribute("href") || "";
      const text = ((a.textContent || "") + (a.getAttribute("aria-label") || "")).toLowerCase();
      return href.startsWith("#") && (text.includes("skip") || text.includes("saltar") || text.includes("ir al contenido"));
    });

    const missingMainLandmark = !document.querySelector("main") && !document.querySelector("[role='main']");
    const missingNavLandmark = !document.querySelector("nav") && !document.querySelector("[role='navigation']");
    const autoplaying = document.querySelectorAll("video[autoplay], audio[autoplay]").length;
    const formFields = document.querySelectorAll(
      "input[type='text'], input[type='email'], input[type='tel'], input[type='password'], input[type='url'], input[type='search'], input:not([type])"
    );
    const formFieldsWithoutAutocomplete = Array.from(formFields).filter(
      (f) => !f.getAttribute("autocomplete")
    ).length;

    return {
      imgWithoutAlt, totalImages: images.length,
      buttonsWithoutLabel, totalButtons: buttons.length,
      inputsWithoutLabel, totalInputs: inputs.length,
      linksWithoutText, totalLinks: links.length,
      missingLang, headingOrderValid, headingSequence,
      lowContrastTexts, missingSkipLink,
      missingMainLandmark, missingNavLandmark,
      autoplaying, totalFormFields: formFields.length,
      formFieldsWithoutAutocomplete,
    };
  });
}

// ── Core capture ──────────────────────────────────────────────────────────────

async function capturePageToStorage(
  page: Page,
  url: string,
  jobId: string
): Promise<ScreenshotResult> {
  const result: ScreenshotResult = { url, screenshotPath: "", title: "", description: "" };

  try {
    await page.setViewport({ width: 1280, height: 800 });

    // Use domcontentloaded + short extra wait instead of networkidle2
    // networkidle2 can hang 30s+ on pages with analytics/trackers
    await page.goto(toCaptureUrl(url), { waitUntil: "domcontentloaded", timeout: 15000 });
    // Brief wait for images and late-loading content
    await new Promise((r) => setTimeout(r, 2000));

    await neutraliseSmoothScroll(page);

    const title = await page.title();
    const description = await page.evaluate(() => {
      const el =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      return el?.getAttribute("content") || "";
    });

    const seoData = await extractSeoData(page);
    const a11yData = await extractA11yData(page);

    const slug = urlToSlug(url);
    const filename = `${slug}.jpg`;

    const rawBuffer = await page.screenshot({ type: "jpeg", quality: 60, fullPage: true });
    const buffer = Buffer.isBuffer(rawBuffer) ? rawBuffer : Buffer.from(rawBuffer as Uint8Array);
    const publicUrl = await uploadToStorage(buffer, jobId, filename);

    result.screenshotPath = publicUrl;
    result.title = title;
    result.description = description;
    result.seo = { titleLength: title.length, descriptionLength: description.length, ...seoData };
    result.a11y = a11yData;
  } catch (err) {
    result.error = err instanceof Error ? err.message : "Error desconocido";
    result.title = url;
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Recapture a single URL (used by /recapture route). */
export async function processSingleScreenshot(
  jobDir: string,
  url: string
): Promise<ScreenshotResult> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    const result = await capturePageToStorage(page, url, jobDir);
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
    if (browser) await browser.close().catch(() => {});
  }
}

