/**
 * Records the touch experience at 390px: paging a card carousel by swiping,
 * jumping with the dots, opening the bottom sheet, swiping the carousel inside
 * it without dismissing it, and navigating collections from the drawer.
 *
 * Usage: node scripts/demo-mobile.mjs [--url http://localhost:3010] [--out /tmp/demo]
 */

import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const URL = readArg("url", "http://localhost:3010");
const OUT = readArg("out", "/tmp/demo");
const CHROME = "/opt/google/chrome/chrome";

const VIEWPORT = { width: 390, height: 844 };
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: VIEWPORT,
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
  recordVideo: { dir: OUT, size: VIEWPORT },
});
const page = await context.newPage();

/** Dispatches a real touch drag so the app's swipe handling is exercised. */
async function swipe(handle, dx, steps = 8) {
  const box = await handle.boundingBox();
  const y = Math.round(box.y + box.height / 2);
  const from = Math.round(box.x + box.width / 2 - dx / 2);
  await handle.evaluate(
    (node, { from, y, dx, steps }) =>
      new Promise((resolve) => {
        const point = (x) => [
          new Touch({ identifier: 1, target: node, clientX: x, clientY: y }),
        ];
        const fire = (type, x) =>
          node.dispatchEvent(
            new TouchEvent(type, {
              bubbles: true,
              cancelable: true,
              touches: type === "touchend" ? [] : point(x),
              targetTouches: type === "touchend" ? [] : point(x),
              changedTouches: point(x),
            }),
          );
        fire("touchstart", from);
        let step = 1;
        const tick = () => {
          if (step > steps) {
            fire("touchend", from + dx);
            resolve();
            return;
          }
          fire("touchmove", from + (dx * step) / steps);
          step += 1;
          setTimeout(tick, 22);
        };
        setTimeout(tick, 22);
      }),
    { from, y, dx, steps },
  );
}

const pause = (ms) => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0, null, {
  timeout: 45000,
});
await pause(1800);

const card = page.locator("article").first();
const frame = card.locator("div[style*='aspect-ratio']").first();

// Swipe through the card's screens right on the thumbnail.
for (let i = 0; i < 3; i += 1) {
  await swipe(frame, -190);
  await pause(950);
}
await swipe(frame, 190);
await pause(900);

// Jump with a dot.
await card.getByRole("button", { name: "Show screen 5" }).tap();
await pause(1100);
await card.getByRole("button", { name: "Show screen 1" }).tap();
await pause(1100);

// Tap-accessible actions (no hover on touch).
await card.getByRole("button", { name: "Reference actions" }).tap();
await pause(1400);
await page.keyboard.press("Escape");
await pause(600);

// Open the bottom sheet and swipe its carousel without dismissing it.
await card.locator("button[aria-label^='Open ']").first().tap();
await pause(1500);
const sheet = page.locator("[role='dialog']");
const sheetFrame = sheet.locator("div[style*='aspect-ratio']").first();
for (let i = 0; i < 2; i += 1) {
  await swipe(sheetFrame, -190);
  await pause(1000);
}
await sheet.getByRole("button", { name: "Next screen" }).tap();
await pause(1000);
// Scroll to the metadata, then close.
await sheet.evaluate((node) => {
  const scroller = [...node.querySelectorAll("*")].find(
    (child) => child.scrollHeight > child.clientHeight + 8,
  );
  scroller?.scrollBy({ top: 320, behavior: "smooth" });
});
await pause(2000);
await sheet.getByRole("button", { name: "Close" }).first().tap();
await pause(1200);

// Collections from the drawer.
await page.getByRole("button", { name: "Menu" }).tap();
await pause(1400);
await page.locator("[role='dialog']").getByRole("button", { name: /Dashboards/ }).first().tap();
await pause(1800);
const dashboardCard = page.locator("article").first();
await swipe(dashboardCard.locator("div[style*='aspect-ratio']").first(), -190);
await pause(1100);

await page.getByRole("button", { name: "Menu" }).tap();
await pause(1000);
await page.locator("[role='dialog']").getByRole("button", { name: /Typography/ }).first().tap();
await pause(2000);

await page.getByRole("button", { name: "Menu" }).tap();
await pause(900);
await page.locator("[role='dialog']").getByRole("button", { name: /Mobile Apps/ }).first().tap();
await pause(1800);

await context.close();
await browser.close();
console.log(`video written under ${OUT}`);
