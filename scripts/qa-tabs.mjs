/**
 * Walks every tab in the sidebar and checks that what it claims matches what
 * it shows: the count badge against the number of rendered cards, the
 * collections listed on each card against the tab it appeared under, and the
 * empty-state copy for tabs that are legitimately empty. Also exercises the
 * mobile drawer, search and filters.
 *
 * Usage: node scripts/qa-tabs.mjs [--url http://localhost:3010] [--shots /tmp/qa]
 */

import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const URL = readArg("url", "http://localhost:3010");
const SHOTS = readArg("shots", null);
const CHROME = "/opt/google/chrome/chrome";

let failures = 0;
const checks = [];
function check(name, pass, detail = "") {
  checks.push({ name, pass, detail });
  if (!pass) failures += 1;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0, null, {
  timeout: 45000,
});
await page.waitForTimeout(1000);

/** Reads the sidebar rows: label plus the count badge. */
async function navRows() {
  return page.evaluate(() => {
    const nav = document.querySelector("aside nav");
    if (!nav) return [];
    return [...nav.querySelectorAll("button")]
      .map((button) => {
        const spans = [...button.querySelectorAll("span")];
        const label = spans.find((s) => s.classList.contains("truncate"))?.textContent?.trim();
        const count = spans.find((s) => /^\d+$/.test(s.textContent?.trim() ?? ""));
        return label ? { label, count: count ? Number(count.textContent.trim()) : null } : null;
      })
      .filter(Boolean);
  });
}

/** Card titles come from the detail metadata, so read them from the DB copy. */
async function galleryState() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("article")];
    return {
      count: cards.length,
      titles: cards.map(
        (card) =>
          card
            .querySelector("button[aria-label^='Open ']")
            ?.getAttribute("aria-label")
            ?.replace(/^Open /, "") ?? "?",
      ),
      screens: cards.map((card) => card.querySelectorAll("img").length),
      empty: document.querySelector(".gallery-grid")
        ? null
        : document.querySelector("p")?.textContent?.trim() ?? null,
    };
  });
}

const rows = await navRows();
console.log("\n=== sidebar ===");
for (const row of rows) console.log(`  ${row.label}: ${row.count}`);

const report = { tabs: {}, references: {} };

console.log("\n=== every tab ===");
for (const row of rows) {
  await page.getByRole("button", { name: row.label, exact: false }).first().click();
  await page.waitForTimeout(450);
  const state = await galleryState();
  check(
    `${row.label}: count badge matches rendered cards`,
    row.count === state.count,
    `badge ${row.count} vs ${state.count} cards`,
  );
  if (state.count === 0) {
    check(`${row.label}: shows an explanatory empty state`, Boolean(state.empty), state.empty ?? "none");
  } else {
    check(
      `${row.label}: every card has 3+ screens`,
      state.screens.every((n) => n >= 3),
      `min ${Math.min(...state.screens)}`,
    );
  }
  report.tabs[row.label] = {
    count: row.count,
    rendered: state.count,
    empty: state.empty,
    titles: state.titles,
  };
  if (SHOTS && state.count === 0) {
    await page.screenshot({ path: `${SHOTS}/tab-empty-${row.label.replace(/\W+/g, "-")}.png` });
  }
}

// Read every reference's own collection list from IndexedDB and confirm the
// tab it rendered under is one of them.
const stored = await page.evaluate(async () => {
  const open = indexedDB.open("design-reference-library");
  const db = await new Promise((resolve, reject) => {
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  const read = (store) =>
    new Promise((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  const [references, collections] = await Promise.all([read("references"), read("collections")]);
  const byId = new Map(collections.map((c) => [c.id, c.name]));
  return references.map((reference) => ({
    title: reference.title,
    seedKey: reference.seedKey,
    screens: (reference.screens ?? []).length,
    collections: (reference.collectionIds ?? []).map((id) => byId.get(id) ?? id).sort(),
  }));
});

console.log("\n=== references ===");
for (const reference of [...stored].sort((a, b) => a.title.localeCompare(b.title))) {
  console.log(
    `  ${reference.title} | screens=${reference.screens} | ${reference.collections.join(", ")}`,
  );
  report.references[reference.title] = reference;
}
check(
  "every reference has at least 3 screens",
  stored.every((reference) => reference.screens >= 3),
  `min ${Math.min(...stored.map((r) => r.screens))}`,
);
check(
  "every reference belongs to at least one collection",
  stored.every((reference) => reference.collections.length > 0),
  "",
);
check("no duplicate reference titles", new Set(stored.map((r) => r.title)).size === stored.length, "");

// A card must only appear under a collection it actually belongs to.
for (const [label, tab] of Object.entries(report.tabs)) {
  if (!["Mobile Apps", "Web", "Dashboards", "Landing Pages", "Onboarding", "Motion"].includes(label)) {
    continue;
  }
  const wrong = tab.titles.filter((title) => {
    const reference = report.references[title];
    return reference && !reference.collections.includes(label);
  });
  check(`${label}: contains only references filed under it`, wrong.length === 0, wrong.join(", "));
}

// Search narrows the gallery and the counts together.
await page.getByRole("button", { name: "All References", exact: false }).first().click();
await page.waitForTimeout(300);
const searchBox = page.getByPlaceholder("Search references…");
await searchBox.fill("dashboard");
await page.waitForTimeout(500);
const searched = await galleryState();
const searchedRows = await navRows();
const allRow = searchedRows.find((row) => row.label === "All References");
check(
  "search: count follows the filtered gallery",
  allRow?.count === searched.count,
  `badge ${allRow?.count} vs ${searched.count} cards`,
);
check("search: returns dashboard references", searched.count > 0, `${searched.count} cards`);

await searchBox.fill("zzzznotfound");
await page.waitForTimeout(500);
const none = await galleryState();
check("search: no matches shows the query back", Boolean(none.empty?.includes("zzzznotfound")), none.empty ?? "");
if (SHOTS) await page.screenshot({ path: `${SHOTS}/search-empty.png` });
await searchBox.fill("");
await page.waitForTimeout(400);

// Filters
await page.getByRole("button", { name: "Filter" }).first().click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: "Dashboards", exact: true }).last().click();
await page.waitForTimeout(500);
const filtered = await galleryState();
const filteredRows = await navRows();
check(
  "filter: gallery matches the Dashboards count",
  filtered.count === filteredRows.find((r) => r.label === "Dashboards")?.count,
  `${filtered.count} cards`,
);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

await context.close();

// Mobile drawer navigation
const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const mobilePage = await mobile.newPage();
await mobilePage.goto(URL, { waitUntil: "domcontentloaded" });
await mobilePage.waitForFunction(() => document.querySelectorAll("article").length > 0, null, {
  timeout: 45000,
});
await mobilePage.waitForTimeout(800);

console.log("\n=== mobile drawer ===");
check(
  "mobile: no persistent sidebar",
  await mobilePage.evaluate(() => {
    const nav = document.querySelector("aside nav");
    if (!nav) return true;
    const rect = nav.getBoundingClientRect();
    return rect.width === 0;
  }),
  "",
);
await mobilePage.getByRole("button", { name: "Menu" }).tap();
await mobilePage.waitForTimeout(500);
const drawerOpen = await mobilePage.locator("[role='dialog']").count();
check("mobile: drawer opens from the hamburger", drawerOpen > 0, "");
if (SHOTS) await mobilePage.screenshot({ path: `${SHOTS}/drawer-390.png` });

const drawerFits = await mobilePage.evaluate(() => {
  const dialog = document.querySelector("[role='dialog']");
  if (!dialog) return false;
  const rect = dialog.getBoundingClientRect();
  return rect.right <= window.innerWidth + 1 && rect.left >= -1;
});
check("mobile: drawer fits the viewport", drawerFits, "");

await mobilePage.locator("[role='dialog']").getByRole("button", { name: /Dashboards/ }).first().tap();
await mobilePage.waitForTimeout(600);
check(
  "mobile: choosing a collection closes the drawer",
  (await mobilePage.locator("[role='dialog']").count()) === 0,
  "",
);
const mobileState = await mobilePage.evaluate(() => document.querySelectorAll("article").length);
check("mobile: Dashboards shows its references", mobileState === 3, `${mobileState} cards`);
if (SHOTS) await mobilePage.screenshot({ path: `${SHOTS}/dashboards-390.png` });

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await mobile.close();
await browser.close();

if (SHOTS) {
  await writeFile(`${SHOTS}/tab-report.json`, JSON.stringify(report, null, 1));
}

const passed = checks.filter((c) => c.pass).length;
console.log(`\n${passed}/${checks.length} checks passed`);
if (failures) {
  console.log("\nfailures:");
  for (const c of checks.filter((x) => !x.pass)) console.log(`  - ${c.name} ${c.detail}`);
}
process.exit(failures ? 1 : 0);
