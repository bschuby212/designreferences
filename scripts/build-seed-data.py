#!/usr/bin/env python3
"""Turn harvested Mobbin data into the seeded example library.

Every seeded reference must carry at least three genuinely different screens,
so references are built per app + platform from two sources of real screens:

  flows  - the ordered screens of a captured user flow (sampled across the flow
           so the carousel walks through the journey rather than adjacent frames)
  screens- the individual screens we hold for that app, when there are 3 or more

Apps that cannot reach three distinct screens are left out instead of being
padded with duplicates or crops. Section captures (marketing pages) are
excluded as well: their videos only yield one clean state plus mid-transition
frames.

Images are downloaded into public/screens/<key> so the library does not depend
on signed CDN URLs staying valid.

Usage: python3 scripts/build-seed-data.py [--limit-screens 5] [--no-download]
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "scripts", "mobbin-data.json")
PUBLIC = os.path.join(ROOT, "public", "screens")
PROBES = os.path.join(ROOT, "scripts", ".cache", "probes")
MANIFEST = os.path.join(ROOT, "scripts", "seed-manifest.json")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36"

MIN_SCREENS = 3
SEED_REVISION = "2026-08-audit-1"

# Categories below come from looking at every screen of every reference (see
# scripts/make-audit-sheets.py), not from the collection the seed used to sit in.
#
# Rules applied:
#   Mobile Apps   - the screens are an iOS app UI
#   Web           - the screens are a desktop web UI
#   Dashboards    - the screens are charts / KPI / analytics surfaces
#   Onboarding    - the reference walks through signup or first-run
#   Landing Pages - the reference includes the product's marketing site
#   Motion        - the screens capture loading / transition states
#   Navigation, Typography, Branding - no reference qualified; a tab bar being
#   present in an app screenshot does not make the screenshot a nav reference,
#   which is exactly the mistake this audit is undoing.
AUDIT: dict[str, dict] = {
    "ahead-ios-flow": {
        "title": "Ahead iOS onboarding flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Signup, personality quiz, recommended journeys, then the Pro paywall.",
    },
    "airbnb-ios-flow": {
        "title": "Airbnb iOS sign-up flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Log in or sign up, profile details, community commitment, then the Explore tab.",
    },
    "headspace-ios-flow": {
        "title": "Headspace iOS onboarding flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Welcome, account creation with inline validation, value screens, trial timeline.",
    },
    "instagram-ios-flow": {
        "title": "Instagram iOS sign-up flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Save login info, email step, profile picture sheet, then the home feed.",
    },
    "luma-ios-flow": {
        "title": "Luma iOS onboarding flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Email and phone sign-in, profile and bio, then the Discover tab.",
    },
    "mozi-ios-flow": {
        "title": "Mozi iOS onboarding flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Sign in with Apple, SMS code, location picker, permissions, then home.",
    },
    "revolut-ios-flow": {
        "title": "Revolut iOS account opening flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Phone entry, code error state, identity verification options, plan selection.",
    },
    "revolut-ios-flow-5": {
        "title": "Revolut iOS identity verification flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Six digit code, verification options, passcode creation, Onfido consent.",
    },
    "spotify-ios-flow": {
        "title": "Spotify iOS sign-up flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Account creation, gender picker, artist and podcast pickers, then home.",
    },
    "uber-ios-flow": {
        "title": "Uber iOS sign-up flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "SMS code, name entry, card details, then the ride home screen.",
    },
    "uber-eats-ios-flow": {
        "title": "Uber Eats iOS sign-up flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Mobile number, verification code, name, then payment method selection.",
    },
    "wise-ios-flow": {
        "title": "Wise iOS onboarding flow",
        "collections": ["Mobile Apps", "Onboarding"],
        "notes": "Brand intro, phone verification, notification permission, then the account home.",
    },
    "revolut-ios-screens": {
        "title": "Revolut iOS account home",
        "collections": ["Mobile Apps"],
        "notes": "Three variants of the account home: balance, quick actions, transactions.",
    },
    "uber-eats-ios-screens": {
        "title": "Uber Eats iOS home and loading states",
        "collections": ["Mobile Apps", "Motion"],
        "notes": "Home feed plus two in-progress states: AI cart skeleton and ride search.",
    },
    "pinterest-ios-screens": {
        "title": "Pinterest iOS feed transitions",
        "collections": ["Mobile Apps", "Motion"],
        "notes": "Shop the look, feed tuning progress, save transition, finishing-up toast.",
    },
    "speak-ios-screens": {
        "title": "Speak iOS lesson loading states",
        "collections": ["Mobile Apps", "Motion"],
        "notes": "Personalised lesson build, character styling progress, in-lesson spinner.",
    },
    "copy-ai-web-flow": {
        "title": "Copy.ai web sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Marketing homepage, sign-up, email verification, team size, then the workspace.",
    },
    "dialpad-web-flow": {
        "title": "Dialpad web trial sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Support marketing page, trial steps with billing summary, then admin settings.",
    },
    "manus-web-flow": {
        "title": "Manus web account and upgrade flow",
        "collections": ["Web", "Onboarding"],
        "notes": "Starts inside the product: prompt home, account creation, phone check, plan modal.",
    },
    "maze-web-flow": {
        "title": "Maze web sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Marketing homepage, account creation, role questions, then the project dashboard.",
    },
    "navattic-web-flow": {
        "title": "Navattic web sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Marketing homepage, account creation, integrations, plan questions, product demos.",
    },
    "rox-web-flow": {
        "title": "Rox web sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Dark marketing homepage, account modals, welcome step, then the agent workspace.",
    },
    "runway-web-flow": {
        "title": "Runway web sign-up flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Marketing hero and feature sections, account creation, then the generation tool.",
    },
    "shop-web-flow": {
        "title": "Shop web sign-in flow",
        "collections": ["Web", "Onboarding", "Landing Pages"],
        "notes": "Shop marketing page, email sign-in, code confirmation, back to the storefront.",
    },
    "hootsuite-web-screens": {
        "title": "Hootsuite web analytics dashboards",
        "collections": ["Web", "Dashboards"],
        "notes": "Listening metrics, performance highlights, and social impact reporting views.",
    },
    "navattic-web-screens": {
        "title": "Navattic web analytics dashboards",
        "collections": ["Web", "Dashboards"],
        "notes": "Demo analytics, visitor table with detail panel, and pipeline impact charts.",
    },
    "substack-web-screens": {
        "title": "Substack web publisher dashboards",
        "collections": ["Web", "Dashboards"],
        "notes": "Subscriber growth overview, podcast download charts, and the posts table.",
    },
}


def slug(*parts: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", " ".join(p for p in parts if p).lower()).strip("-")


def sample(items: list, count: int) -> list:
    """Evenly spaced sample that always keeps the first and last item."""
    if len(items) <= count:
        return list(items)
    if count == 1:
        return [items[0]]
    step = (len(items) - 1) / (count - 1)
    picked = []
    for i in range(count):
        item = items[round(i * step)]
        if item not in picked:
            picked.append(item)
    return picked


def sized(url: str, width: int) -> str:
    """Ask the CDN for a webp at the width we actually render."""
    if "bytescale.mobbin.com" not in url:
        return url
    if "?enc=" in url:
        # Signed transformation: the format is baked in, leave it alone.
        return url
    base = url.split("?")[0]
    return f"{base}?f=webp&w={width}&q=72&fit=shrink-cover"


def build_references(data: list[dict]) -> list[dict]:
    flows = [r for r in data if r["kind"] == "flow" and len(r.get("screens") or []) >= MIN_SCREENS]
    screens = [r for r in data if r["kind"] == "screen"]

    references: list[dict] = []

    for flow in flows:
        app, platform = flow.get("appName"), flow.get("platform")
        if not app or not platform:
            continue
        references.append(
            {
                "kind": "flow",
                "app": app,
                "platform": platform,
                "sourceUrl": flow["url"],
                "seedTitle": flow["title"],
                "seedCollection": flow["collection"],
                "screenUrls": [s["url"] for s in flow["screens"]],
                "totalScreens": len(flow["screens"]),
                "patterns": sorted({p for s in [] for p in s}),
                "pagePatterns": flow.get("pagePatterns") or [],
                "appCategories": flow.get("appCategories") or [],
            }
        )

    by_app: dict[tuple, list[dict]] = collections.defaultdict(list)
    for record in screens:
        by_app[(record["appName"], record["platform"])].append(record)

    for (app, platform), rows in by_app.items():
        unique: list[dict] = []
        seen: set[str] = set()
        for row in rows:
            if row["imageUrl"] in seen:
                continue
            seen.add(row["imageUrl"])
            unique.append(row)
        if len(unique) < MIN_SCREENS:
            continue
        patterns = sorted({p for row in unique for p in (row.get("screenPatterns") or [])})
        elements = sorted({e for row in unique for e in (row.get("screenElements") or [])})
        references.append(
            {
                "kind": "screens",
                "app": app,
                "platform": platform,
                "sourceUrl": unique[0]["url"],
                "seedTitle": f"{app} {platform} screens",
                "seedCollection": unique[0]["collection"],
                "screenUrls": [row["imageUrl"] for row in unique],
                "screenTitles": [row.get("name") or "" for row in unique],
                "totalScreens": len(unique),
                "patterns": patterns,
                "elements": elements,
                "appCategories": unique[0].get("appCategories") or [],
            }
        )

    for index, reference in enumerate(references):
        suffix = "flow" if reference["kind"] == "flow" else "screens"
        reference["key"] = slug(reference["app"], reference["platform"], suffix)
        # Two Revolut onboarding flows exist; keep both but keep keys unique.
        if any(other["key"] == reference["key"] for other in references[:index]):
            reference["key"] = slug(reference["key"], str(index))
    return references


def probe_weight(url: str) -> int:
    """Rough "how much is on this screen" measure.

    A tiny webp of a launch screen (a centred logo on flat colour) compresses
    to a fraction of the size of a screen full of UI, which is enough to avoid
    opening a carousel on an almost empty slide.
    """
    key = hashlib.sha1(("probe:" + url).encode()).hexdigest() + ".webp"
    path = os.path.join(PROBES, key)
    if os.path.exists(path):
        return os.path.getsize(path)
    os.makedirs(PROBES, exist_ok=True)
    try:
        request = urllib.request.Request(sized(url, 160), headers={"User-Agent": UA})
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
        with open(path, "wb") as handle:
            handle.write(body)
        return len(body)
    except Exception:
        return 0


def trim_leading_blanks(candidates: list[str]) -> list[str]:
    """Drops leading launch/splash screens, keeping flow order intact."""
    if len(candidates) < 4:
        return candidates
    weights = [probe_weight(url) for url in candidates]
    usable = [w for w in weights if w > 0]
    if not usable:
        return candidates
    median = sorted(usable)[len(usable) // 2]
    start = 0
    while start < len(candidates) - 3 and weights[start] < median * 0.55:
        start += 1
    return candidates[start:]


def download(job: tuple[str, str]) -> tuple[str, bool]:
    url, path = job
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path, True
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        request = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(request, timeout=90) as response:
            body = response.read()
        if len(body) < 500:
            return path, False
        with open(path, "wb") as handle:
            handle.write(body)
        return path, True
    except Exception:
        return path, False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit-screens", type=int, default=5)
    parser.add_argument("--no-download", action="store_true")
    args = parser.parse_args()

    data = json.load(open(DATA))
    references = build_references(data)
    print(f"references: {len(references)}  "
          f"(flows: {sum(1 for r in references if r['kind'] == 'flow')}, "
          f"screen sets: {sum(1 for r in references if r['kind'] == 'screens')})")

    jobs: list[tuple[str, str]] = []
    for reference in references:
        candidates = reference["screenUrls"]
        # Flows open on a launch screen that is little more than a centred
        # logo. Those are real screens but poor first slides, so skip past them
        # while the flow has screens to spare.
        if reference["kind"] == "flow":
            candidates = trim_leading_blanks(candidates)
        picked = sample(candidates, args.limit_screens)
        width = 520 if reference["platform"] == "ios" else 900
        reference["screens"] = []
        for index, url in enumerate(picked):
            path = os.path.join(PUBLIC, reference["key"], f"{index + 1:02d}.webp")
            jobs.append((sized(url, width), path))
            reference["screens"].append(
                {
                    "src": f"/screens/{reference['key']}/{index + 1:02d}.webp",
                    "remote": url,
                    "path": path,
                }
            )

    if not args.no_download:
        print(f"downloading {len(jobs)} images ...")
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(download, jobs))
        failed = [path for path, ok in results if not ok]
        print(f"downloaded: {len(results) - len(failed)}  failed: {len(failed)}")
        for path in failed[:10]:
            print("  !", path)
        for reference in references:
            reference["screens"] = [
                s for s in reference["screens"]
                if os.path.exists(s["path"]) and os.path.getsize(s["path"]) > 500
            ]

    complete = [r for r in references if len(r["screens"]) >= MIN_SCREENS]
    dropped = [r for r in references if len(r["screens"]) < MIN_SCREENS]
    print(f"complete references (>= {MIN_SCREENS} screens): {len(complete)}  dropped: {len(dropped)}")
    for reference in dropped:
        print("  dropped", reference["key"], len(reference["screens"]))

    missing = [r["key"] for r in complete if r["key"] not in AUDIT]
    if missing:
        print("\n!! references with no audited category:", missing)
        return 1

    for reference in complete:
        audit = AUDIT[reference["key"]]
        reference["title"] = audit["title"]
        reference["collections"] = audit["collections"]
        reference["notes"] = audit["notes"]
        reference["tags"] = tags_for(reference)
        reference["aspect"] = "portrait" if reference["platform"] == "ios" else "landscape"

    with open(MANIFEST, "w") as handle:
        json.dump(complete, handle, indent=1, sort_keys=True)
    print("wrote", MANIFEST)

    write_seed_file(complete)

    print("\n=== per reference ===")
    for reference in sorted(complete, key=lambda r: (r["platform"], r["app"])):
        print(f"  {reference['key']:<34} {reference['platform']:<4} "
              f"screens={len(reference['screens'])}/{reference['totalScreens']:<3} "
              f"was={reference['seedCollection']:<12} now={reference['collections']}")

    counts: dict[str, int] = collections.Counter()
    for reference in complete:
        counts.update(reference["collections"])
    print("\n=== collection counts ===")
    for name, count in counts.most_common():
        print(f"  {count:>3}  {name}")
    return 0


def tags_for(reference: dict) -> list[str]:
    tags = ["mobile" if reference["platform"] == "ios" else "web"]
    if reference["platform"] == "ios":
        tags.append("ios")
    tags.append("flow" if reference["kind"] == "flow" else "screens")
    for pattern in reference.get("patterns") or []:
        tags.append(pattern.lower())
    seen: list[str] = []
    for tag in tags:
        if tag not in seen:
            seen.append(tag)
    return seen[:6]


def ts_string(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def write_seed_file(references: list[dict]) -> None:
    order = {
        "Mobile Apps": 0,
        "Web": 1,
        "Dashboards": 2,
        "Landing Pages": 3,
        "Onboarding": 4,
        "Motion": 5,
    }

    def sort_key(reference: dict) -> tuple:
        first = min(order.get(c, 99) for c in reference["collections"])
        return (first, reference["app"].lower(), reference["key"])

    lines = [
        "// Generated by scripts/build-seed-data.py - do not edit by hand.",
        "//",
        "// Every seeded reference carries at least three genuinely different screens",
        "// (sampled across a captured flow, or distinct screens of the same app) and the",
        "// collections were assigned by reviewing those screens. Regenerate with:",
        "//   python3 scripts/harvest-mobbin.py && python3 scripts/build-seed-data.py",
        "",
        'import type { SourceType } from "./types";',
        "",
        "export interface ExampleScreen {",
        "  src: string;",
        "  label: string;",
        "}",
        "",
        "export interface ExampleSeed {",
        "  key: string;",
        "  title: string;",
        "  url: string;",
        "  collections: string[];",
        "  screens: ExampleScreen[];",
        "  tags: string[];",
        "  notes: string;",
        "  source: SourceType;",
        "  aspect: \"portrait\" | \"landscape\";",
        "}",
        "",
        "// Bump when the seeded examples change so existing browsers replace them.",
        f'export const SEED_REVISION = "{SEED_REVISION}";',
        "",
        "export const EXAMPLE_SEEDS: ExampleSeed[] = [",
    ]
    for reference in sorted(references, key=sort_key):
        screens = ",\n".join(
            f"      {{ src: {ts_string(screen['src'])}, label: "
            f"{ts_string(f'Screen {index + 1}')} }}"
            for index, screen in enumerate(reference["screens"])
        )
        lines += [
            "  {",
            f"    key: {ts_string(reference['key'])},",
            f"    title: {ts_string(reference['title'])},",
            f"    url: {ts_string(reference['sourceUrl'])},",
            f"    collections: [{', '.join(ts_string(c) for c in reference['collections'])}],",
            f"    tags: [{', '.join(ts_string(t) for t in reference['tags'])}],",
            f"    notes: {ts_string(reference['notes'])},",
            '    source: "Mobbin",',
            f"    aspect: {ts_string(reference['aspect'])},",
            "    screens: [",
            screens + ",",
            "    ],",
            "  },",
        ]
    lines += ["];", ""]
    target = os.path.join(ROOT, "src", "lib", "storage", "seed-examples.ts")
    with open(target, "w") as handle:
        handle.write("\n".join(lines))
    print("wrote", target)


if __name__ == "__main__":
    sys.exit(main())
