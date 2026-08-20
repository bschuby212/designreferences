import * as cheerio from "cheerio";
import { detectSource } from "./detectSource";
import type { LinkPreview } from "./types";
import type { ThumbnailType } from "@/lib/storage/types";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MOBBIN_CDN =
  "https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content";

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
  const trimmed = decodeEntities(value);
  if (!trimmed || trimmed.startsWith("data:")) return "";
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return "";
  }
}

function meta($: cheerio.CheerioAPI, ...keys: string[]) {
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

function isGenericOg(url: string) {
  return /\/og_image\.png(?:\?|$)/i.test(url) || /\/og\.png(?:\?|$)/i.test(url);
}

function cdnAsset(kind: "app_screens" | "sites", id: string, ext: string) {
  return `${MOBBIN_CDN}/${kind}/${id}.${ext}?f=png&w=1200&q=70&fit=shrink-cover`;
}

function productImagesFromHtml(
  html: string,
  pageUrl: string,
  $: cheerio.CheerioAPI,
) {
  const candidates: Array<{ url: string; type: ThumbnailType }> = [];
  const seen = new Set<string>();
  const add = (raw: string | undefined, type: ThumbnailType) => {
    const url = absUrl(raw, pageUrl);
    if (!url || isGenericOg(url) || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, type });
  };

  const og = absUrl(meta($, "og:image", "og:image:url", "og:image:secure_url"), pageUrl);
  if (og) {
    try {
      const screenUrl = new URL(og).searchParams.get("screenUrl");
      add(screenUrl ?? "", "og");
    } catch {
      // Ignore malformed og URLs.
    }
  }

  const screen = html.match(/content\/app_screens\/([0-9a-f-]{36})\.(png|webp|jpg)/i);
  if (screen) add(cdnAsset("app_screens", screen[1], screen[2]), "og");
  const site = html.match(/content\/sites\/([0-9a-f-]{36})\.(png|webp|jpg)/i);
  if (site) add(cdnAsset("sites", site[1], site[2]), "og");

  add(og, "og");
  add(meta($, "twitter:image", "twitter:image:src"), "twitter");
  add(meta($, "image") || $('link[rel="image_src"]').attr("href"), "meta");

  $('script[type="application/ld+json"]').each((_, el) => {
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
      add(src, "meta");
    } catch {
      // Ignore malformed JSON-LD.
    }
  });

  return candidates;
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

function tweetStatusId(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (!/^(x|twitter|mobile\.twitter)\.com$/.test(host)) return null;
    return parsed.pathname.match(/\/status(?:es)?\/(\d+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

async function tweetScreens(url: string) {
  const id = tweetStatusId(url);
  if (!id) return { title: "", photos: [] as string[] };
  try {
    const res = await fetchWithTimeout(
      `https://api.fxtwitter.com/status/${id}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) return { title: "", photos: [] as string[] };
    const data = (await res.json()) as {
      tweet?: {
        text?: string;
        author?: { name?: string; screen_name?: string };
        media?: {
          photos?: Array<{ url?: string }>;
          all?: Array<{ type?: string; url?: string }>;
        };
      };
    };
    const tweet = data.tweet;
    const photos = [
      ...(tweet?.media?.photos ?? []).map((photo) => photo.url),
      ...(tweet?.media?.all ?? [])
        .filter((item) => item.type === "photo" || item.type === "image")
        .map((item) => item.url),
    ].filter((src): src is string => Boolean(src));
    const author = tweet?.author?.name || tweet?.author?.screen_name || "";
    const text = (tweet?.text ?? "").replace(/\s+/g, " ").trim();
    const title = author || text ? [author, text].filter(Boolean).join(" — ") : "";
    return { title, photos: [...new Set(photos)] };
  } catch {
    return { title: "", photos: [] as string[] };
  }
}

function withScreens(
  preview: Omit<LinkPreview, "screens">,
  screens: string[],
): LinkPreview {
  const unique = [...new Set(screens.filter(Boolean))];
  return { ...preview, screens: unique };
}

export async function generateLinkPreview(
  rawUrl: string,
  preferredImageUrl?: string,
): Promise<LinkPreview> {
  let url: string;
  try {
    url = new URL(rawUrl).toString();
  } catch {
    throw new Error("Invalid URL");
  }

  const source = detectSource(url);
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  const tweet = source === "X" ? await tweetScreens(url) : { title: "", photos: [] as string[] };
  const empty: LinkPreview = {
    title: hostname,
    url,
    siteName: hostname,
    favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
    source,
    thumbnailUrl: preferredImageUrl || tweet.photos[0] || null,
    thumbnail: null,
    thumbnailType: "placeholder",
    screens: tweet.photos,
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
    // Preview can still succeed from a known product image URL.
  }

  let title = tweet.title;
  let siteName = hostname;
  let favicon = empty.favicon;
  const candidates: Array<{ url: string; type: ThumbnailType }> = [];

  if (preferredImageUrl) {
    candidates.push({ url: preferredImageUrl, type: "og" });
  }
  for (const photo of tweet.photos) {
    if (!candidates.some((item) => item.url === photo)) {
      candidates.push({ url: photo, type: "twitter" });
    }
  }

  if (html) {
    const $ = cheerio.load(html);
    title = decodeEntities(
      tweet.title ||
        meta($, "og:title", "twitter:title") ||
        $("title").first().text() ||
        "",
    ).replace(/\s*\|\s*Mobbin.*$/i, "");
    siteName = decodeEntities(meta($, "og:site_name") || hostname);

    const iconHref =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href");
    favicon = absUrl(iconHref, url) || empty.favicon;

    for (const candidate of productImagesFromHtml(html, url, $)) {
      if (!candidates.some((item) => item.url === candidate.url)) {
        candidates.push(candidate);
      }
    }
  }

  for (const candidate of candidates) {
    const thumbnail = await fetchImage(candidate.url);
    if (thumbnail) {
      return withScreens(
        {
          title: title || tweet.title || hostname,
          url,
          siteName,
          favicon,
          source,
          thumbnailUrl: candidate.url,
          thumbnail,
          thumbnailType: candidate.type,
        },
        tweet.photos.length ? tweet.photos : [candidate.url],
      );
    }
  }

  const thumbnailUrl =
    tweet.photos[0] || candidates[0]?.url || preferredImageUrl || null;
  if (source !== "Mobbin") {
    const screenshot = await fetchScreenshot(url);
    if (screenshot) {
      return withScreens(
        {
          title: title || tweet.title || hostname,
          url,
          siteName,
          favicon,
          source,
          thumbnailUrl,
          thumbnail: screenshot,
          thumbnailType: "screenshot",
        },
        tweet.photos,
      );
    }
  }

  return withScreens(
    {
      ...empty,
      title: title || tweet.title || hostname,
      siteName,
      favicon,
      thumbnailUrl,
      thumbnailType: thumbnailUrl ? "twitter" : "placeholder",
    },
    tweet.photos,
  );
}
