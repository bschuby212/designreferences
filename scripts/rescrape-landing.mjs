/**
 * Recapture Web & Landing Pages at a real 1440×1080 desktop viewport.
 * Writes webp files and a JSON map used to patch seed-examples.ts.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "screens", "landing");
const MAP = join(ROOT, "scripts", ".cache", "landing-rescrape.json");

const SITES = {
  "Rox Web Landing Page": "https://www.rox.com/",
  "Maze Web Landing Page": "https://maze.co/",
  "Navattic Web Landing Page": "https://www.navattic.com/",
  "Copy.ai Web Landing Page": "https://www.copy.ai/",
  "Shop Web Landing Page": "https://shop.app/",
  "Dialpad Web Landing Page": "https://www.dialpad.com/",
  "Runway Web Landing Page": "https://runwayml.com/",
  "Ease section": "https://easehealth.com/",
  "Antimetal section": "https://antimetal.com/",
  "Mercury section": "https://mercury.com/",
  "ISO Meet section": "https://www.isomeet.com/",
  "Superpower section": "https://superpower.com/",
  "ClickUp section": "https://clickup.com/",
  "Runway section": "https://runwayml.com/",
  "Paraform section": "https://www.paraform.com/",
  "Ada section": "https://www.ada.cx/",
  "Ramp section": "https://ramp.com/",
  "T1 Energy section": "https://t1energy.com/",
  "Aave section": "https://aave.com/",
  "Midday section": "https://midday.ai/",
  "Current section": "https://current.com/",
  "Oevra section": "https://oevra.com/",
  "Depop Web E-commerce Landing Page": "https://www.depop.com/",
  "Google Workspace Web Plan Comparison": "https://workspace.google.com/",
  "OpenSea Web OpenSea Landing Page": "https://opensea.io/",
  "Intercom Web Homepage": "https://www.intercom.com/",
  "Twitch Web Twitch Homepage": "https://www.twitch.tv/",
  "Outseta Web Homepage": "https://www.outseta.com/",
  "Lemon Squeezy section": "https://www.lemonsqueezy.com/",
  "Duolingo section": "https://www.duolingo.com/",
  "Mailchimp section": "https://mailchimp.com/",
  "Twingate section": "https://www.twingate.com/",
  "Mixpanel section": "https://mixpanel.com/",
  "Miro section": "https://miro.com/",
  "WhatsApp section": "https://www.whatsapp.com/",
  "Fey section": "https://www.fey.com/",
  "Webflow section": "https://webflow.com/",
  "Clockwise section": "https://www.getclockwise.com/",
  "Better Stack section": "https://betterstack.com/",
  "Grammarly section": "https://www.grammarly.com/",
  "Coda section": "https://coda.io/",
  "TIDAL section": "https://tidal.com/",
  "Dovetail section": "https://dovetail.com/",
  "Zendesk section": "https://www.zendesk.com/",
  "Gamma section": "https://gamma.app/",
  "Framer section": "https://www.framer.com/",
  "ElevenLabs section": "https://elevenlabs.io/",
  "Uniswap section": "https://uniswap.org/",
  "Sprig section": "https://sprig.com/",
  "Deel section": "https://www.deel.com/",
};

const FEATURE =
  /\b(features?|benefits?|why .{0,24}|how it works|built for|product|platform|capabilities|what you (get|can))\b/i;
const SOCIAL =
  /\b(testimonials?|customers?|reviews?|loved by|trusted|stories|case stud|pricing|plans?)\b/i;
const SKIP =
  /\b(log ?in|sign ?in|sign ?up|register|cookie|privacy|footer|careers?|blog|press)\b/i;
const COOKIE_TEXT = [
  "Accept all",
  "Accept All",
  "Accept cookies",
  "Allow all",
  "I agree",
  "Got it",
  "OK",
  "Accept",
];

function parseSeeds() {
  const text = readFileSync(join(ROOT, "src/lib/storage/seed-examples.ts"), "utf8");
  const chunks = text.split("\n  {\n");
  const rows = [];
  for (const chunk of chunks) {
    if (!chunk.includes('"Web & Landing Pages"')) continue;
    const key = chunk.match(/key: "([^"]+)"/)?.[1];
    const title = chunk.match(/title: "([^"]+)"/)?.[1];
    if (key && title) rows.push({ key, title });
  }
  return rows;
}

async function dismissChrome(page) {
  const extra = ["No thank you", "No thanks", "Not now", "Close"];
  for (const label of [...COOKIE_TEXT, ...extra]) {
    const button = page.getByRole("button", { name: new RegExp(`^${label}$`, "i") });
    try {
      if (await button.first().isVisible({ timeout: 600 })) {
        await button.first().click({ timeout: 800 });
        await page.waitForTimeout(250);
      }
    } catch {
      /* ignore */
    }
  }
  try {
    await page.addStyleTag({
      content: `
        [id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i],
        [id*="onetrust" i], [class*="onetrust" i], #CybotCookiebotDialog {
          display: none !important; visibility: hidden !important;
        }
      `,
    });
  } catch {
    /* CSP on some marketing sites blocks injected styles. */
  }
}

async function sectionYs(page) {
  return page.evaluate(
    ({ feature, social, skip }) => {
      const featureRe = new RegExp(feature, "i");
      const socialRe = new RegExp(social, "i");
      const skipRe = new RegExp(skip, "i");
      const height = document.documentElement.scrollHeight;
      const view = window.innerHeight;
      const footerStart = Math.max(0, height - view * 1.15);
      const hits = { feature: [], social: [] };
      for (const el of document.querySelectorAll("h1,h2,h3,h4,[role='heading']")) {
        const text = (el.innerText || "").trim();
        if (!text || text.length > 80 || skipRe.test(text)) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top < view * 0.7 || top > footerStart) continue;
        if (featureRe.test(text)) hits.feature.push(Math.max(0, Math.round(top - 72)));
        else if (socialRe.test(text)) hits.social.push(Math.max(0, Math.round(top - 72)));
      }
      const unique = (values) => [...new Set(values)].sort((a, b) => a - b);
      return {
        height,
        view,
        feature: unique(hits.feature)[0] ?? null,
        social: unique(hits.social)[0] ?? null,
      };
    },
    { feature: FEATURE.source, social: SOCIAL.source, skip: SKIP.source },
  );
}

async function captureAt(page, y) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(1100);
  return page.screenshot({
    type: "jpeg",
    quality: 84,
    fullPage: false,
    animations: "disabled",
  });
}

function looksLikeAuth(url, title) {
  return /\b(log[ -]?in|sign[ -]?in|sign[ -]?up|register|auth)\b/i.test(`${url} ${title}`);
}

async function scrapeOne(browser, seed) {
  const url = SITES[seed.title];
  if (!url) return { key: seed.key, title: seed.title, ok: false, error: "no site map" };
  const folder = join(OUT, seed.key);
  mkdirSync(folder, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    await page.waitForTimeout(2200);
    await dismissChrome(page);
    try {
      await page.keyboard.press("Escape");
    } catch {
      /* ignore */
    }
    await page.waitForTimeout(700);
    const pageTitle = await page.title();
    if (looksLikeAuth(page.url(), pageTitle)) {
      throw new Error(`auth page ${page.url()}`);
    }
    const found = await sectionYs(page);
    const footerY = Math.max(0, found.height - found.view);
    const yHero = 0;
    let yFeature = found.feature;
    let ySocial = found.social;
    if (yFeature == null) yFeature = Math.min(Math.round(found.view * 0.95), footerY);
    if (ySocial == null) {
      ySocial = Math.min(Math.round(found.view * 1.85), Math.max(0, footerY - 40));
    }
    // Keep shots distinct and above the footer.
    const ys = [];
    for (const y of [yHero, yFeature, ySocial]) {
      const clamped = Math.max(0, Math.min(y, footerY));
      if (ys.some((existing) => Math.abs(existing - clamped) < 420)) continue;
      ys.push(clamped);
    }
    while (ys.length < 3 && ys[ys.length - 1] < footerY) {
      const next = Math.min(footerY, ys[ys.length - 1] + Math.round(found.view * 0.72));
      if (Math.abs(next - ys[ys.length - 1]) < 280) break;
      if (ys.some((existing) => Math.abs(existing - next) < 280)) break;
      ys.push(next);
    }

    const labels = ["Hero", "Features", "Testimonials or pricing"];
    const screens = [];
    for (let i = 0; i < ys.length && screens.length < 3; i += 1) {
      const jpeg = await captureAt(page, ys[i]);
      if (jpeg.length < 18000) continue;
      const jpgPath = join(folder, `0${screens.length + 1}.jpg`);
      writeFileSync(jpgPath, jpeg);
      screens.push({
        src: `/screens/landing/${seed.key}/0${screens.length + 1}.jpg`,
        label: labels[screens.length] ?? `Section ${screens.length + 1}`,
      });
    }
    if (!screens.length) throw new Error("no usable viewport captures");
    return { key: seed.key, title: seed.title, ok: true, url, screens };
  } catch (error) {
    return { key: seed.key, title: seed.title, ok: false, error: String(error) };
  } finally {
    await context.close();
  }
}

const seeds = parseSeeds();
const only = (process.env.ONLY || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selected = only.length
  ? seeds.filter((seed) => only.includes(seed.title))
  : seeds;
const previous = (() => {
  try {
    return JSON.parse(readFileSync(MAP, "utf8"));
  } catch {
    return [];
  }
})();
const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
});
const results = [...previous];
for (const seed of selected) {
  const result = await scrapeOne(browser, seed);
  console.log(
    result.ok
      ? `ok ${result.title} (${result.screens.length})`
      : `fail ${result.title}: ${result.error}`,
  );
  const index = results.findIndex((row) => row.key === result.key);
  if (index >= 0) results[index] = result;
  else results.push(result);
}
await browser.close();
mkdirSync(dirname(MAP), { recursive: true });
writeFileSync(MAP, JSON.stringify(results, null, 2));
console.log(`wrote ${MAP}`);
