import * as cheerio from "cheerio";
import { detectSource } from "./detectSource";
import type { LinkPreview } from "./types";
import type { ThumbnailType } from "@/lib/storage/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12000,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

function absUrl(value: string | undefined, base: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:")) return "";
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return "";
  }
}

function meta(
  $: cheerio.CheerioAPI,
  ...keys: string[]
) {
  for (const key of keys) {
    const byProp = $(`meta[property="${key}"]`).attr("content");
    if (byProp) return byProp;
    const byName = $(`meta[name="${key}"]`).attr("content");
    if (byName) return byName;
  }
  return "";
}

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

async function fetchImage(url: string) {
  try {
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      },
      15000,
    );
    if (!res.ok) return null;
    const mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (mime && !mime.startsWith("image/") && mime !== "application/octet-stream") {
      return null;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength < 64 || buffer.byteLength > MAX_IMAGE_BYTES) return null;
    return {
      mime: mime.startsWith("image/") ? mime : "image/jpeg",
      data: buffer.toString("base64"),
    };
  } catch {
    return null;
  }
}

async function fetchScreenshot(url: string) {
  const shots = [
    `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1200`,
    `https://image.thum.io/get/width/1200/noanimate/${url}`,
  ];
  for (const shot of shots) {
    const image = await fetchImage(shot);
    if (image) return image;
  }
  return null;
}

export async function generateLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url: string;
  try {
    url = new URL(rawUrl).toString();
  } catch {
    throw new Error("Invalid URL");
  }

  const source = detectSource(url);
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const empty: LinkPreview = {
    title: hostname,
    url,
    siteName: hostname,
    favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    source,
    thumbnail: null,
    thumbnailType: "placeholder",
  };

  let html = "";
  try {
    const res = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (res.ok) {
      const contentType = res.headers.get("content-type") || "";
      if (
        !contentType ||
        contentType.includes("text/html") ||
        contentType.includes("application/xhtml") ||
        contentType.includes("text/plain")
      ) {
        html = await res.text();
      }
      url = res.url || url;
    }
  } catch {
    // Preview can still succeed via screenshot fallback.
  }

  let title = "";
  let siteName = hostname;
  let favicon = empty.favicon;
  const candidates: Array<{ url: string; type: ThumbnailType }> = [];

  if (html) {
    const $ = cheerio.load(html);
    title = decodeEntities(
      meta($, "og:title", "twitter:title") || $("title").first().text() || "",
    );
    siteName = decodeEntities(meta($, "og:site_name") || hostname);

    const iconHref =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href");
    favicon = absUrl(iconHref, url) || empty.favicon;

    const og = absUrl(meta($, "og:image", "og:image:url", "og:image:secure_url"), url);
    const twitter = absUrl(meta($, "twitter:image", "twitter:image:src"), url);
    const other = absUrl(
      meta($, "image") || $('link[rel="image_src"]').attr("href"),
      url,
    );

    if (og) candidates.push({ url: og, type: "og" });
    if (twitter && twitter !== og) candidates.push({ url: twitter, type: "twitter" });
    if (other && other !== og && other !== twitter) {
      candidates.push({ url: other, type: "meta" });
    }

    const jsonLd = $('script[type="application/ld+json"]');
    jsonLd.each((_, el) => {
      try {
        const parsed = JSON.parse($(el).text()) as { image?: unknown };
        const image = parsed?.image;
        const src =
          typeof image === "string"
            ? image
            : Array.isArray(image)
              ? typeof image[0] === "string"
                ? image[0]
                : (image[0] as { url?: string })?.url
              : (image as { url?: string } | undefined)?.url;
        const resolved = absUrl(src, url);
        if (resolved) candidates.push({ url: resolved, type: "meta" });
      } catch {
        // Ignore malformed JSON-LD.
      }
    });
  }

  for (const candidate of candidates) {
    const thumbnail = await fetchImage(candidate.url);
    if (thumbnail) {
      return {
        title: title || hostname,
        url,
        siteName,
        favicon,
        source,
        thumbnail,
        thumbnailType: candidate.type,
      };
    }
  }

  const screenshot = await fetchScreenshot(url);
  if (screenshot) {
    return {
      title: title || hostname,
      url,
      siteName,
      favicon,
      source,
      thumbnail: screenshot,
      thumbnailType: "screenshot",
    };
  }

  return {
    ...empty,
    title: title || hostname,
    siteName,
    favicon,
  };
}
