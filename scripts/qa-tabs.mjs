/**
 * Verifies chip counts, restored IDs, category membership, search, and filters.
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
const EXPECTED_RETIRED_DUPLICATES = [
  "https://mobbin.com/explore/sections/5b101db5-6858-4280-a8d2-77b31aa1353d",
  "https://mobbin.com/explore/sections/2f4ca455-4c8d-429e-a43a-593170bcd5d0",
  "https://mobbin.com/explore/sections/25505391-659c-4d67-978e-83b976c6e211",
];
const REMOVED_NAV_ITEMS = ["All", "Favorites", "Recent", "Typography", "Branding"];

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
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.querySelectorAll("article").length > 0, null, {
  timeout: 45000,
});
await page.waitForTimeout(1000);

async function navRows() {
  return page.evaluate(() =>
    [...document.querySelectorAll("nav[aria-label='Library categories'] [data-nav-label]")]
      .map((button) => {
        const label = button.getAttribute("data-nav-label");
        const countNode = [...button.querySelectorAll("span")].find((span) =>
          /^\d+$/.test(span.textContent?.trim() ?? ""),
        );
        return {
          label,
          count: countNode ? Number(countNode.textContent.trim()) : null,
        };
      }),
  );
}

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
      images: cards.map((card) => card.querySelectorAll("img").length),
      empty: document.querySelector(".gallery-flex")
        ? null
        : [...document.querySelectorAll("p")]
            .map((node) => node.textContent?.trim())
            .find(Boolean) ?? null,
    };
  });
}

const stored = await page.evaluate(async () => {
  const request = indexedDB.open("design-reference-library");
  const db = await new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const read = (store) =>
    new Promise((resolve, reject) => {
      const result = db.transaction(store).objectStore(store).getAll();
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    });
  const [references, collections] = await Promise.all([read("references"), read("collections")]);
  const byId = new Map(collections.map((collection) => [collection.id, collection.name]));
  return references.map((reference) => ({
    id: reference.id,
    seedKey: reference.seedKey,
    title: reference.title,
    url: reference.url,
    images: (reference.screens ?? []).length,
    sources: (reference.screens ?? []).map((screen) => screen.src),
    categories: (reference.collectionIds ?? [])
      .map((id) => byId.get(id) ?? id)
      .sort(),
  }));
});

const seeded = stored.filter((reference) => reference.seedKey);
check("restored seeded reference count", seeded.length === 157, `${seeded.length}`);
check(
  "every restored reference has a unique URL",
  new Set(seeded.map((reference) => reference.url)).size === seeded.length,
  "",
);
check(
  "every restored reference has a unique seed ID",
  new Set(seeded.map((reference) => reference.seedKey)).size === seeded.length,
  "",
);
check(
  "all references contain at least one image",
  seeded.every((reference) => reference.images >= 1),
  `minimum ${Math.min(...seeded.map((reference) => reference.images))}`,
);
check(
  "valid single-image references remain",
  seeded.filter((reference) => reference.images === 1).length === 120,
  `${seeded.filter((reference) => reference.images === 1).length}`,
);
check(
  "meaningful multi-image references remain",
  seeded.filter((reference) => reference.images > 1).length === 37,
  `${seeded.filter((reference) => reference.images > 1).length}`,
);
check(
  "every reference belongs to a category",
  seeded.every((reference) => reference.categories.length > 0),
  "",
);
check(
  "only the three exact duplicate source IDs are retired",
  EXPECTED_RETIRED_DUPLICATES.every(
    (url) => !seeded.some((reference) => reference.url === url),
  ),
  "",
);

const rows = await navRows();
const report = { total: seeded.length, retired: EXPECTED_RETIRED_DUPLICATES, chips: {} };
console.log("\n=== navigation chips ===");
for (const row of rows) console.log(`  ${row.label}: ${row.count}`);
check(
  "removed navigation items are absent",
  REMOVED_NAV_ITEMS.every((label) => !rows.some((row) => row.label === label)),
  rows.map((row) => row.label).join(", "),
);

for (const row of rows) {
  await page.locator(`[data-nav-label="${row.label}"]`).click();
  await page.waitForTimeout(300);
  const state = await galleryState();
  check(
    `${row.label}: chip count matches rendered cards`,
    row.count === state.count,
    `${row.count} vs ${state.count}`,
  );
  if (state.count === 0) {
    check(`${row.label}: empty state explains the result`, Boolean(state.empty), state.empty ?? "");
  }
  report.chips[row.label] = { count: row.count, rendered: state.count };
}

const categoryLabels = rows.map((row) => row.label);
for (const category of categoryLabels) {
  const expected = seeded.filter((reference) => reference.categories.includes(category)).length;
  const actual = report.chips[category]?.rendered;
  check(`${category}: stored membership matches gallery`, expected === actual, `${expected} vs ${actual}`);
}

check(
  "default canvas is Mobile Apps",
  rows[0]?.label === "Mobile Apps" &&
    (await page.locator('[data-nav-label="Mobile Apps"]').getAttribute("aria-pressed")) === "true",
  rows[0]?.label ?? "",
);

await page.locator('[data-nav-label="Mobile Apps"]').click();
const search = page.getByPlaceholder("Search references…");
await search.fill("headspace");
await page.waitForTimeout(350);
const searched = await galleryState();
const searchedRows = await navRows();
check("search returns Headspace references", searched.count > 0, `${searched.count}`);
check(
  "search updates the Mobile Apps chip count",
  searchedRows.find((row) => row.label === "Mobile Apps")?.count === searched.count,
  `${searched.count}`,
);
await search.fill("zzzznotfound");
await page.waitForTimeout(300);
const none = await galleryState();
check("search empty state includes the query", Boolean(none.empty?.includes("zzzznotfound")), none.empty ?? "");
await search.fill("");

await page.getByRole("button", { name: "Filter" }).first().click();
for (const label of ["Favorites", "Typography", "Branding"]) {
  check(
    `filter panel excludes ${label}`,
    (await page.getByRole("button", { name: label, exact: true }).count()) === 0,
    "",
  );
}
await page.getByRole("button", { name: "Onboarding", exact: true }).last().click();
await page.waitForTimeout(350);
const filtered = await galleryState();
const filteredRows = await navRows();
check(
  "filters update chip counts and rendered cards together",
  filteredRows.find((row) => row.label === "Mobile Apps")?.count === filtered.count,
  `${filtered.count}`,
);

check("no browser errors", errors.length === 0, errors.slice(0, 2).join(" | "));

if (SHOTS) {
  await page.screenshot({ path: `${SHOTS}/chip-navigation-1440.png` });
  await writeFile(`${SHOTS}/chip-report.json`, JSON.stringify(report, null, 1));
}
await context.close();
await browser.close();

const passed = checks.filter((item) => item.pass).length;
console.log(`\n${passed}/${checks.length} checks passed`);
if (failures) {
  for (const item of checks.filter((entry) => !entry.pass)) {
    console.log(`  - ${item.name}: ${item.detail}`);
  }
}
process.exit(failures ? 1 : 0);
