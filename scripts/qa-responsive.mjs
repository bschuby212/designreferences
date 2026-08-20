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
  { width: 1440, height: 950, touch: false },
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
        if (node.matches("nav[aria-label='Library categories'] *")) continue;
        if (node.matches("nav[aria-label='Library categories']")) continue;
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

function counterIn(locator) {
  return locator.evaluate((host) => {
    const badge = [...host.querySelectorAll("div")].find((node) =>
      /^\d+\/\d+$/.test(node.textContent?.trim() ?? ""),
    );
    return badge ? badge.textContent.trim() : null;
  });
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

  // The restored library intentionally contains both complete single images
  // and meaningful multi-image references.
  const screenCounts = await page.evaluate(() =>
    [...document.querySelectorAll("article")].map(
      (card) => card.querySelectorAll("img").length,
    ),
  );
  check(
    `${label}: every card has at least one image`,
    screenCounts.length > 0 && screenCounts.every((n) => n >= 1),
    `min ${Math.min(...screenCounts)} max ${Math.max(...screenCounts)}`,
  );
  const cardPresentation = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("article")];
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    return {
      titled: cards.every((card) =>
        Boolean(
          [...card.querySelectorAll("button")]
            .find((button) => !button.getAttribute("aria-label"))
            ?.textContent?.trim(),
        ),
      ),
      metadata: cards.some((card) => /Mobbin|\d+ images?/i.test(card.textContent ?? "")),
      bordered: cards.some((card) => {
        const style = getComputedStyle(card);
        return style.borderStyle !== "none" && parseFloat(style.borderWidth) > 0;
      }),
      whitePage: bodyBg === "rgb(255, 255, 255)",
      preview: (() => {
        const frame = document.querySelector("article div[style*='aspect-ratio']");
        if (!frame) return null;
        const style = getComputedStyle(frame);
        const image = frame.querySelector("img");
        const frameBox = frame.getBoundingClientRect();
        const imageBox = image?.getBoundingClientRect();
        return {
          background: style.backgroundColor,
          radius: parseFloat(style.borderRadius),
          inset:
            Boolean(imageBox) &&
            imageBox.width < frameBox.width - 20 &&
            imageBox.height < frameBox.height - 20,
        };
      })(),
    };
  });
  check(`${label}: every card shows its product name`, cardPresentation.titled, "");
  check(`${label}: cards hide source and image-count labels`, !cardPresentation.metadata, "");
  check(`${label}: cards have no visible stroke`, !cardPresentation.bordered, "");
  check(`${label}: page background is white`, cardPresentation.whitePage, "");
  check(
    `${label}: preview is a large rounded gray container`,
    Boolean(cardPresentation.preview) &&
      cardPresentation.preview.background !== "rgb(255, 255, 255)" &&
      cardPresentation.preview.radius >= 20,
    JSON.stringify(cardPresentation.preview),
  );
  check(
    `${label}: phone screenshot sits inset in the preview`,
    Boolean(cardPresentation.preview?.inset),
    JSON.stringify(cardPresentation.preview),
  );

  // Card height must not change while paging.
  const firstCard = page.locator("article").filter({
    has: page.getByRole("button", { name: "Next screen" }),
  }).first();
  const singleCard = page.locator("article").filter({
    hasNot: page.getByRole("button", { name: "Next screen" }),
  }).first();
  check(`${label}: multi-image carousel card exists`, (await firstCard.count()) === 1, "");
  check(`${label}: single-image card exists`, (await singleCard.count()) === 1, "");
  check(
    `${label}: single-image card has no carousel controls`,
    (await singleCard.getByRole("button", {
      name: /^(Previous screen|Next screen|Show screen \d+)$/,
    }).count()) === 0 &&
      (await counterIn(singleCard)) === null,
    "",
  );
  const beforeBox = await firstCard.boundingBox();
  const frameBox = await firstCard.locator("div[style*='aspect-ratio']").first().boundingBox();
  check(
    `${label}: portrait carousel uses a 3:4 preview`,
    Boolean(frameBox) && Math.abs((frameBox.width / frameBox.height) - 3 / 4) < 0.05,
    frameBox ? `${Math.round(frameBox.width)}×${Math.round(frameBox.height)}` : "missing",
  );
  const landscapeFrame = page.locator("article div[style*='16 / 10']").first();
  if ((await landscapeFrame.count()) > 0) {
    const landscapeBox = await landscapeFrame.boundingBox();
    check(
      `${label}: landscape cards use a 16:10 preview`,
      Boolean(landscapeBox) && Math.abs((landscapeBox.width / landscapeBox.height) - 16 / 10) < 0.05,
      landscapeBox
        ? `${Math.round(landscapeBox.width)}×${Math.round(landscapeBox.height)}`
        : "missing",
    );
  }
  const before = await counterIn(firstCard);
  check(`${label}: card shows n/total badge`, Boolean(before), String(before));

  if (viewport.touch) {
    const frame = firstCard.locator("div[style*='aspect-ratio']").first();
    await swipe(page, frame, -140);
    const afterSwipe = await counterIn(firstCard);
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
    const afterArrow = await counterIn(firstCard);
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
  const dotBefore = await counterIn(firstCard);
  const dots = firstCard.getByRole("button", { name: /Show screen \d+/ });
  const dotCount = await dots.count();
  if (dotCount >= 3) {
    await dots.nth(2).click();
    const dotAfter = await counterIn(firstCard);
    check(
      `${label}: pagination dot jumps to screen`,
      dotAfter === `3/${dotAfter?.split("/")[1]}` && dotAfter !== dotBefore,
      `${dotBefore} -> ${dotAfter}`,
    );
    // Every dot, including the first, must page without opening the detail
    // view: they sit next to the open target, so a stray bubble would be easy
    // to miss by eye.
    let opened = 0;
    for (let position = 0; position < dotCount; position += 1) {
      await dots.nth(position).click();
      await page.waitForTimeout(120);
      const detailOpen =
        (await page.locator("[role='dialog']").count()) +
        (await page.locator("aside").filter({ hasText: "Screens" }).count());
      if (detailOpen > 0) opened += 1;
      const seen = await counterIn(firstCard);
      if (seen !== `${position + 1}/${dotCount}`) {
        check(`${label}: dot ${position + 1} selects its screen`, false, String(seen));
      }
    }
    check(`${label}: no dot opens the detail view`, opened === 0, `${opened} of ${dotCount} did`);
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
      chipNav: visible(document.querySelector("nav[aria-label='Library categories']")),
      chipScrollable: (() => {
        const nav = document.querySelector("nav[aria-label='Library categories'] > div");
        return nav ? nav.scrollWidth > nav.clientWidth : false;
      })(),
      hamburger: byLabel("Menu").length,
      density: byLabel("compact").length + byLabel("medium").length + byLabel("large").length,
      actionsMenu: byLabel("Reference actions").length,
      columns: (() => {
        const cards = [...document.querySelectorAll("article")];
        if (cards.length === 0) return 0;
        const firstTop = Math.round(cards[0].getBoundingClientRect().top);
        return cards.filter((card) => Math.round(card.getBoundingClientRect().top) === firstTop).length;
      })(),
    };
  });
  check(`${label}: side navigation is absent`, !chrome.sidebar, "");
  check(`${label}: horizontal chip navigation is visible`, chrome.chipNav, "");
  check(`${label}: no navigation drawer trigger`, chrome.hamburger === 0, "");
  check(`${label}: header width toggle is absent`, chrome.density === 0, "");
  const expectedColumns =
    viewport.width < 768 ? 1 : viewport.width < 1024 ? 2 : viewport.width >= 1600 ? 4 : 3;
  check(
    `${label}: at most ${expectedColumns} cards per row`,
    chrome.columns > 0 && chrome.columns <= expectedColumns,
    `${chrome.columns} in first row`,
  );
  if (viewport.width < 768) {
    check(`${label}: chip row scrolls within its container`, chrome.chipScrollable, "");
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
  const detail = page.locator("[role='dialog']").filter({ hasText: "Notes" });
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
    check(
      `${label}: detail has one consolidated notes area`,
      (await inDetail.getByText("Notes", { exact: true }).count()) === 1 &&
        (await inDetail.getByText(/Comments/i).count()) === 0,
      "",
    );

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
    const detailDots = inDetail.getByRole("button", { name: /Show screen \d+/ });
    const detailDotCount = await detailDots.count();
    if (detailDotCount > 1) {
      await detailDots.first().click();
      await page.waitForTimeout(250);
      const afterDot = await inDetail.evaluate((node) => {
        const badge = [...node.querySelectorAll("div")].find((item) =>
          /^\d+\/\d+$/.test(item.textContent?.trim() ?? ""),
        );
        return badge?.textContent?.trim() ?? null;
      });
      check(`${label}: detail pagination dot works`, afterDot === `1/${detailDotCount}`, String(afterDot));
      check(`${label}: detail dot does not dismiss modal`, (await detail.count()) > 0, "");
    }

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
    if (viewport.width < 768) {
      check(`${label}: mobile detail scrolls internally`, fits.scrollable, "");
    } else {
      const modalSize = await inDetail.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return {
          widthRatio: rect.width / window.innerWidth,
          heightRatio: rect.height / window.innerHeight,
        };
      });
      check(
        `${label}: desktop modal uses most of the viewport`,
        modalSize.widthRatio > 0.8 && modalSize.heightRatio > 0.8,
        `${modalSize.widthRatio.toFixed(2)} × ${modalSize.heightRatio.toFixed(2)}`,
      );
    }

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

  const singleOpenTarget = singleCard.locator("button[aria-label^='Open ']").first();
  if (viewport.touch) await singleOpenTarget.tap();
  else await singleOpenTarget.click();
  await page.waitForTimeout(350);
  const singleDetail = page.locator("[role='dialog']").filter({ hasText: "Notes" });
  check(`${label}: single-image detail opens`, (await singleDetail.count()) === 1, "");
  if ((await singleDetail.count()) === 1) {
    check(
      `${label}: single-image detail has no carousel controls`,
      (await singleDetail.getByRole("button", {
        name: /^(Previous screen|Next screen|Show screen \d+)$/,
      }).count()) === 0,
      "",
    );
    await singleDetail.getByRole("button", { name: "Close" }).first().click();
    await page.waitForTimeout(250);
  }

  if (viewport.width >= 1280) {
    await page.locator('[data-nav-label="Web"]').click();
    await page.waitForTimeout(400);
    await page.waitForFunction(() =>
      [...document.querySelectorAll("article img")]
        .slice(0, 12)
        .every((image) => image.complete && image.naturalWidth > 0),
    );
    const desktopThumbs = await page.evaluate(() =>
      [...document.querySelectorAll("article img")].slice(0, 20).map((image) => {
        const style = getComputedStyle(image);
        return {
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          objectFit: style.objectFit,
          objectPosition: style.objectPosition,
        };
      }),
    );
    check(
      `${label}: web thumbnails use 1440×1080 source frames`,
      desktopThumbs.length > 0 &&
        desktopThumbs.every(
          (image) => image.naturalWidth === 1440 && image.naturalHeight === 1080,
        ),
      JSON.stringify(desktopThumbs.slice(0, 2)),
    );
    check(
      `${label}: web thumbnails preserve proportions`,
      desktopThumbs.every((image) => image.objectFit === "contain"),
      JSON.stringify(desktopThumbs.slice(0, 2)),
    );
    const webFrame = page.locator("article div[style*='16 / 10']").first();
    const webBox = (await webFrame.count()) > 0 ? await webFrame.boundingBox() : null;
    check(
      `${label}: web cards use a 16:10 preview`,
      Boolean(webBox) && Math.abs((webBox.width / webBox.height) - 16 / 10) < 0.05,
      webBox ? `${Math.round(webBox.width)}×${Math.round(webBox.height)}` : "missing",
    );
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/web-gallery-${viewport.width}.png` });
    }
    await page.locator('[data-nav-label="Mobile Apps"]').click();
    await page.waitForTimeout(250);
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
