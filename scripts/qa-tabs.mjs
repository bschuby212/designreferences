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
const EXPECTED_CHIPS = [
  "Mobile Apps",
  "Web & Landing Pages",
  "Dashboards",
  "Mobile Onboarding",
  "Web Sign-Up",
  "Mobile Navigation",
];
const REMOVED_NAV_ITEMS = [
  "All",
  "Favorites",
  "Recent",
  "Typography",
  "Branding",
  "Motion",
  "Web",
  "Landing Pages",
  "Onboarding",
  "Navigation",
];
const WEB_SIGNUP_FLOW_KEYS = [
  "original-ab8dcea1-9830-43e8-9487-fe6ce5910c84",
  "original-e064f4d1-4ee1-4748-ba66-f2172caa277d",
  "original-242ff3d6-866e-4a34-87eb-715354f9d45f",
  "original-0c3206ce-2ec1-4408-8a00-24190ec7651d",
  "original-ec2d5551-50bd-45c9-be09-b5a84a3f6605",
  "original-7f996659-bee1-4760-b1e2-7918e3816f20",
  "original-950c4839-2b7d-4a9e-9e15-52b1c5e77769",
  "original-808643f4-122e-40a8-9b14-bc25c7379c34",
];

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
check("restored seeded reference count", seeded.length === 293, `${seeded.length}`);
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
  seeded.filter((reference) => reference.images === 1).length === 139,
  `${seeded.filter((reference) => reference.images === 1).length}`,
);
check(
  "meaningful multi-image references remain",
  seeded.filter((reference) => reference.images > 1).length === 154,
  `${seeded.filter((reference) => reference.images > 1).length}`,
);
check(
  "every reference belongs to a category",
  seeded.every((reference) => reference.categories.length > 0),
  "",
);
check(
  "obsolete canvas names are gone",
  seeded.every(
    (reference) =>
      !reference.categories.some((name) =>
        ["Web", "Landing Pages", "Onboarding", "Navigation"].includes(name),
      ),
  ),
  seeded
    .filter((reference) =>
      reference.categories.some((name) =>
        ["Web", "Landing Pages", "Onboarding", "Navigation"].includes(name),
      ),
    )
    .map((reference) => `${reference.title}:${reference.categories.join("+")}`)
    .join(", "),
);
check(
  "web account-entry flows sit on Web Sign-Up",
  WEB_SIGNUP_FLOW_KEYS.every((key) =>
    seeded.some(
      (reference) =>
        reference.seedKey === key && reference.categories.includes("Web Sign-Up"),
    ),
  ),
  WEB_SIGNUP_FLOW_KEYS.filter(
    (key) =>
      !seeded.some(
        (reference) =>
          reference.seedKey === key && reference.categories.includes("Web Sign-Up"),
      ),
  ).join(", "),
);
check(
  "web sign-up flows are absent from Web & Landing Pages",
  seeded
    .filter((reference) => reference.categories.includes("Web Sign-Up"))
    .every((reference) => !reference.categories.includes("Web & Landing Pages")),
  seeded
    .filter(
      (reference) =>
        reference.categories.includes("Web Sign-Up") &&
        reference.categories.includes("Web & Landing Pages"),
    )
    .map((reference) => reference.title)
    .join(", "),
);
check(
  "Mobile Apps membership excludes onboarding",
  seeded.filter((reference) => reference.categories.includes("Mobile Apps")).length === 60,
  `${seeded.filter((reference) => reference.categories.includes("Mobile Apps")).length}`,
);
check(
  "Mobile Onboarding membership stays at 50",
  seeded.filter((reference) => reference.categories.includes("Mobile Onboarding")).length === 50,
  `${seeded.filter((reference) => reference.categories.includes("Mobile Onboarding")).length}`,
);
check(
  "Mobile Apps and Mobile Onboarding are mutually exclusive",
  seeded.every(
    (reference) =>
      !(
        reference.categories.includes("Mobile Apps") &&
        reference.categories.includes("Mobile Onboarding")
      ),
  ),
  seeded
    .filter(
      (reference) =>
        reference.categories.includes("Mobile Apps") &&
        reference.categories.includes("Mobile Onboarding"),
    )
    .map((reference) => `${reference.seedKey}:${reference.title}`)
    .join(", "),
);
check(
  "every seed ID belongs to at most one of Mobile Apps or Mobile Onboarding",
  new Set(
    seeded
      .filter(
        (reference) =>
          reference.categories.includes("Mobile Apps") ||
          reference.categories.includes("Mobile Onboarding"),
      )
      .map((reference) => reference.seedKey),
  ).size ===
    seeded.filter((reference) => reference.categories.includes("Mobile Apps")).length +
      seeded.filter((reference) => reference.categories.includes("Mobile Onboarding")).length,
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
const defaultPressed = await page.locator('[data-nav-label="Mobile Apps"]').getAttribute("aria-pressed");
check(
  "removed navigation items are absent",
  REMOVED_NAV_ITEMS.every((label) => !rows.some((row) => row.label === label)),
  rows.map((row) => row.label).join(", "),
);
check(
  "chip labels match the six canonical canvases",
  rows.map((row) => row.label).join("|") === EXPECTED_CHIPS.join("|"),
  rows.map((row) => row.label).join(", "),
);
check(
  "default canvas is Mobile Apps",
  rows[0]?.label === "Mobile Apps" && defaultPressed === "true",
  `${rows[0]?.label ?? ""} pressed=${defaultPressed}`,
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
  report.chips[row.label] = { count: row.count, rendered: state.count, titles: state.titles };
  if (row.label === "Mobile Apps") {
    const leaked = state.titles.filter((title) => /onboarding/i.test(title));
    check(
      "Mobile Apps gallery has no onboarding cards",
      leaked.length === 0,
      leaked.join(", "),
    );
  }
  if (row.label === "Mobile Onboarding") {
    check(
      "Mobile Onboarding gallery still has Headspace",
      state.titles.some((title) => /headspace/i.test(title)),
      state.titles.slice(0, 8).join(", "),
    );
  }
}

const categoryLabels = rows.map((row) => row.label);
for (const category of categoryLabels) {
  const expected = seeded.filter((reference) => reference.categories.includes(category)).length;
  const actual = report.chips[category]?.rendered;
  check(`${category}: stored membership matches gallery`, expected === actual, `${expected} vs ${actual}`);
}

await page.locator('[data-nav-label="Mobile Apps"]').click();
const search = page.getByPlaceholder("Search references…");
await search.fill("klarna");
await page.waitForTimeout(350);
const searched = await galleryState();
const searchedRows = await navRows();
check("search returns Klarna in Mobile Apps", searched.count > 0, `${searched.count}`);
check(
  "search updates the Mobile Apps chip count",
  searchedRows.find((row) => row.label === "Mobile Apps")?.count === searched.count,
  `${searched.count}`,
);
await search.fill("headspace");
await page.waitForTimeout(350);
const onboardingLeak = await galleryState();
check(
  "Headspace onboarding does not appear in Mobile Apps search",
  onboardingLeak.count === 0,
  onboardingLeak.titles.join(", "),
);
await page.locator('[data-nav-label="Mobile Onboarding"]').click();
await page.waitForTimeout(300);
const onboardingSearch = await galleryState();
check(
  "Headspace remains in Mobile Onboarding search",
  onboardingSearch.count > 0 && onboardingSearch.titles.some((title) => /headspace/i.test(title)),
  onboardingSearch.titles.join(", "),
);
await page.locator('[data-nav-label="Mobile Apps"]').click();
await search.fill("zzzznotfound");
await page.waitForTimeout(300);
const none = await galleryState();
check("search empty state includes the query", Boolean(none.empty?.includes("zzzznotfound")), none.empty ?? "");
await search.fill("");

const sourceFilter = page.getByLabel("Source");
await sourceFilter.click();
const sourceMenu = page.getByRole("listbox", { name: "Source" });
const sourceOptions = await sourceMenu.getByRole("option").allTextContents();
for (const label of ["Favorites", "Typography", "Branding"]) {
  check(
    `source filter excludes ${label}`,
    !sourceOptions.some((option) => option.trim() === label),
    "",
  );
}
await sourceMenu.getByRole("option", { name: "Website", exact: true }).click();
await page.waitForTimeout(350);
const filtered = await galleryState();
const filteredRows = await navRows();
check(
  "filters update chip counts and rendered cards together",
  filteredRows.find((row) => row.label === "Mobile Apps")?.count === filtered.count,
  `${filtered.count}`,
);
await sourceFilter.click();
await page.getByRole("option", { name: "All sources", exact: true }).click();

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
