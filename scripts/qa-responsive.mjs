/**
 * Drives the running app through the checks that are easy to get wrong by eye:
 * horizontal overflow at every required width, carousels advancing from their
 * own controls in both the gallery and the detail view, controls not opening or
 * closing the detail view, and desktop-only chrome staying off touch layouts.
 *
 * Usage: node scripts/qa-responsive.mjs [--url http://localhost:3010]
 *        node scripts/qa-responsive.mjs --shots /tmp/qa
 */

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const URL = readArg("url", "http://localhost:3010");
const SHOTS = readArg("shots", null);
const CHROME = "/opt/google/chrome/chrome";

const WIDTHS = [
  { width: 320, height: 800, touch: true },
  { width: 375, height: 812, touch: true },
  { width: 390, height: 844, touch: true },
  { width: 430, height: 932, touch: true },
  { width: 768, height: 1024, touch: true },
  { width: 1280, height: 900, touch: false },
  { width: 1600, height: 1000, touch: false },
];

const results = [];
let failures = 0;

function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  if (!pass) failures += 1;
  const mark = pass ? "ok  " : "FAIL";
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function seeded(page) {
  await page.waitForFunction(
    () => document.querySelectorAll("article").length > 0,
    null,
    { timeout: 45000 },
  );
}

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const offenders = [];
    const clips = (node) => {
      const { overflowX } = getComputedStyle(node);
      return overflowX !== "visible";
    };
    for (const node of document.querySelectorAll("body, body *")) {
      // A container the user can actually drag sideways.
      const overflowX = getComputedStyle(node).overflowX;
      if (
        (overflowX === "auto" || overflowX === "scroll") &&
        node.scrollWidth > node.clientWidth + 1
      ) {
        offenders.push({
          reason: "scrollable",
          tag: node.tagName.toLowerCase(),
          cls: String(node.className).slice(0, 60),
          scroll: node.scrollWidth,
          client: node.clientWidth,
        });
        continue;
      }
      // Content sticking out past the viewport with nothing clipping it. A
      // carousel track is wider than its frame on purpose, but the frame
      // clips it, so it is not an offender.
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= window.innerWidth + 1) continue;
      let clipped = false;
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (clips(parent)) {
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        offenders.push({
          reason: "unclipped",
          tag: node.tagName.toLowerCase(),
          cls: String(node.className).slice(0, 60),
          right: Math.round(rect.right),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      innerWidth: window.innerWidth,
      offenders: offenders.slice(0, 5),
    };
  });
}

/** Reads the "n/total" badge of the first card's carousel. */
function counterOf(page, scope = "article") {
  return page.evaluate((selector) => {
    const host = document.querySelector(selector);
    if (!host) return null;
    const badge = [...host.querySelectorAll("div")].find((node) =>
      /^\d+\/\d+$/.test(node.textContent?.trim() ?? ""),
    );
    return badge ? badge.textContent.trim() : null;
  }, scope);
}

async function swipe(page, handle, dx) {
  const box = await handle.boundingBox();
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2 - dx / 2;
  await handle.evaluate(
    (node, { startX, y, dx }) => {
      const touch = (x) => [
        Object.assign(
          new Touch({ identifier: 1, target: node, clientX: x, clientY: y }),
        ),
      ];
      const fire = (type, x) =>
        node.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === "touchend" ? [] : touch(x),
            targetTouches: type === "touchend" ? [] : touch(x),
            changedTouches: touch(x),
          }),
        );
      fire("touchstart", startX);
      fire("touchmove", startX + dx * 0.4);
      fire("touchmove", startX + dx);
      fire("touchend", startX + dx);
    },
    { startX, y, dx },
  );
  await page.waitForTimeout(450);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

if (SHOTS) await mkdir(SHOTS, { recursive: true });

for (const viewport of WIDTHS) {
  const label = `${viewport.width}px${viewport.touch ? " touch" : " pointer"}`;
  console.log(`\n=== ${label} ===`);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    hasTouch: viewport.touch,
    isMobile: viewport.touch,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto(URL, { waitUntil: "domcontentloaded" });
  await seeded(page);
  await page.waitForTimeout(900);

  const cards = await page.locator("article").count();
  check(`${label}: gallery renders cards`, cards > 0, `${cards} cards`);

  const metrics = await overflow(page);
  check(
    `${label}: no horizontal overflow`,
    metrics.scrollWidth <= metrics.clientWidth && metrics.offenders.length === 0,
    `scrollWidth ${metrics.scrollWidth} vs client ${metrics.clientWidth}` +
      (metrics.offenders.length
        ? ` offenders ${JSON.stringify(metrics.offenders)}`
        : ""),
  );

  // Every card must expose at least three screens.
  const screenCounts = await page.evaluate(() =>
    [...document.querySelectorAll("article")].map(
      (card) => card.querySelectorAll("img").length,
    ),
  );
  check(
    `${label}: every card has 3+ screens`,
    screenCounts.length > 0 && screenCounts.every((n) => n >= 3),
    `min ${Math.min(...screenCounts)} max ${Math.max(...screenCounts)}`,
  );

  // Card height must not change while paging.
  const firstCard = page.locator("article").first();
  const beforeBox = await firstCard.boundingBox();
  const before = await counterOf(page);
  check(`${label}: card shows n/total badge`, Boolean(before), String(before));

  if (viewport.touch) {
    const frame = firstCard.locator("div[style*='aspect-ratio']").first();
    await swipe(page, frame, -140);
    const afterSwipe = await counterOf(page);
    check(
      `${label}: swipe advances carousel`,
      Boolean(afterSwipe) && afterSwipe !== before,
      `${before} -> ${afterSwipe}`,
    );
    check(
      `${label}: swipe did not open detail`,
      (await page.locator("[role='dialog']").count()) === 0,
      "",
    );
  } else {
    await firstCard.hover();
    const next = firstCard.getByRole("button", { name: "Next screen" });
    await next.click();
    const afterArrow = await counterOf(page);
    check(
      `${label}: arrow advances carousel`,
      Boolean(afterArrow) && afterArrow !== before,
      `${before} -> ${afterArrow}`,
    );
    check(
      `${label}: arrow did not open detail`,
      (await page.locator("aside").filter({ hasText: "Screens" }).count()) === 0,
      "",
    );
  }

  // Dots work on both input types.
  const dotBefore = await counterOf(page);
  const dots = firstCard.getByRole("button", { name: /Show screen \d+/ });
  const dotCount = await dots.count();
  if (dotCount >= 3) {
    await dots.nth(2).click();
    const dotAfter = await counterOf(page);
    check(
      `${label}: pagination dot jumps to screen`,
      dotAfter === `3/${dotAfter?.split("/")[1]}` && dotAfter !== dotBefore,
      `${dotBefore} -> ${dotAfter}`,
    );
  } else {
    check(`${label}: pagination dots present`, false, `found ${dotCount}`);
  }

  const afterBox = await firstCard.boundingBox();
  check(
    `${label}: card size stable across screens`,
    Math.abs((beforeBox?.height ?? 0) - (afterBox?.height ?? 0)) < 2 &&
      Math.abs((beforeBox?.width ?? 0) - (afterBox?.width ?? 0)) < 2,
    `h ${Math.round(beforeBox?.height ?? 0)} -> ${Math.round(afterBox?.height ?? 0)}`,
  );

  // Images must not be distorted: rendered box vs intrinsic ratio.
  const distorted = await page.evaluate(() => {
    const bad = [];
    for (const img of document.querySelectorAll("article img")) {
      if (!img.complete || !img.naturalWidth) continue;
      const style = getComputedStyle(img);
      if (style.objectFit !== "contain") {
        bad.push({ src: img.currentSrc.split("/").slice(-2).join("/"), fit: style.objectFit });
      }
    }
    return bad;
  });
  check(
    `${label}: screens use contain (no stretching)`,
    distorted.length === 0,
    JSON.stringify(distorted).slice(0, 120),
  );

  // Desktop-only vs mobile-only chrome.
  const chrome = await page.evaluate(() => {
    const visible = (node) => {
      if (!node) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const byLabel = (label) =>
      [...document.querySelectorAll(`[aria-label="${label}"]`)].filter(visible);
    return {
      sidebar: visible(document.querySelector("aside nav")),
      hamburger: byLabel("Menu").length,
      density: byLabel("compact").length,
      actionsMenu: byLabel("Reference actions").length,
    };
  });
  if (viewport.width < 768) {
    check(`${label}: no persistent sidebar`, !chrome.sidebar, "");
    check(`${label}: hamburger present`, chrome.hamburger > 0, "");
    check(`${label}: no density toggle`, chrome.density === 0, "");
  } else {
    check(`${label}: sidebar present`, chrome.sidebar, "");
    check(
      `${label}: hamburger hidden`,
      chrome.hamburger === 0,
      `found ${chrome.hamburger}`,
    );
  }
  if (viewport.touch) {
    check(
      `${label}: tap-accessible card actions`,
      chrome.actionsMenu > 0,
      `${chrome.actionsMenu} buttons`,
    );
  }

  // Detail view: open, page the carousel, confirm it stays open, then close.
  // Tap rather than click on touch layouts so the gesture matches a device.
  const openTarget = firstCard.locator("button[aria-label^='Open ']").first();
  if (viewport.touch) await openTarget.tap();
  else await openTarget.click();
  await page.waitForTimeout(500);
  const detail = viewport.width < 768
    ? page.locator("[role='dialog']")
    : page.locator("aside").filter({ hasText: "Screens" });
  const opened = (await detail.count()) > 0;
  check(`${label}: detail view opens`, opened, "");

  if (opened) {
    const inDetail = detail.first();
    const detailBefore = await inDetail.evaluate((node) => {
      const badge = [...node.querySelectorAll("div")].find((n) =>
        /^\d+\/\d+$/.test(n.textContent?.trim() ?? ""),
      );
      return badge?.textContent?.trim() ?? null;
    });
    check(`${label}: detail carousel has counter`, Boolean(detailBefore), String(detailBefore));

    await inDetail.getByRole("button", { name: "Next screen" }).click();
    await page.waitForTimeout(400);
    const detailAfter = await inDetail.evaluate((node) => {
      const badge = [...node.querySelectorAll("div")].find((n) =>
        /^\d+\/\d+$/.test(n.textContent?.trim() ?? ""),
      );
      return badge?.textContent?.trim() ?? null;
    });
    check(
      `${label}: detail arrow advances`,
      detailAfter !== detailBefore,
      `${detailBefore} -> ${detailAfter}`,
    );
    check(
      `${label}: detail stayed open after paging`,
      (await detail.count()) > 0,
      "",
    );

    const fits = await inDetail.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        withinViewport:
          rect.height <= window.innerHeight + 1 && rect.right <= window.innerWidth + 1,
        scrollable: [...node.querySelectorAll("*")].some(
          (child) => child.scrollHeight > child.clientHeight + 4,
        ),
      };
    });
    check(`${label}: detail fits viewport`, fits.withinViewport, "");
    check(`${label}: detail scrolls internally`, fits.scrollable, "");

    if (viewport.touch) {
      const detailFrame = inDetail.locator("div[style*='aspect-ratio']").first();
      const beforeSwipe = await inDetail.evaluate((node) => {
        const badge = [...node.querySelectorAll("div")].find((n) =>
          /^\d+\/\d+$/.test(n.textContent?.trim() ?? ""),
        );
        return badge?.textContent?.trim() ?? null;
      });
      await swipe(page, detailFrame, -150);
      const afterSwipe = await inDetail.evaluate((node) => {
        const badge = [...node.querySelectorAll("div")].find((n) =>
          /^\d+\/\d+$/.test(n.textContent?.trim() ?? ""),
        );
        return badge?.textContent?.trim() ?? null;
      });
      check(
        `${label}: swipe inside sheet advances`,
        afterSwipe !== beforeSwipe,
        `${beforeSwipe} -> ${afterSwipe}`,
      );
      check(
        `${label}: swipe did not dismiss sheet`,
        (await detail.count()) > 0,
        "",
      );
    }

    if (SHOTS) {
      await page.screenshot({
        path: `${SHOTS}/detail-${viewport.width}.png`,
        fullPage: false,
      });
    }
    await inDetail.getByRole("button", { name: "Close" }).first().click();
    await page.waitForTimeout(400);
    check(`${label}: detail closes`, (await detail.count()) === 0, "");
  }

  const afterAll = await overflow(page);
  check(
    `${label}: still no overflow after interactions`,
    afterAll.scrollWidth <= afterAll.clientWidth,
    `${afterAll.scrollWidth} vs ${afterAll.clientWidth}`,
  );

  check(`${label}: no console errors`, errors.length === 0, errors.slice(0, 2).join(" | "));

  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/gallery-${viewport.width}.png` });
  }
  await context.close();
}

await browser.close();

const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} checks passed`);
if (failures) {
  console.log("\nfailures:");
  for (const result of results.filter((r) => !r.pass)) {
    console.log(`  - ${result.name} ${result.detail}`);
  }
}
process.exit(failures ? 1 : 0);
