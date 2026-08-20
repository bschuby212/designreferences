#!/usr/bin/env python3
"""Rebuild the complete reference library from the original 160-row seed.

The original records live in ``scripts/original-seeds.json`` and were recovered
verbatim from commit 6c21810. Exact duplicate images are retired. Real Mobbin
flows receive the meaningful screens already harvested in ``seed-manifest.json``;
all other references remain valid single-image entries.

Desktop captures are normalized to clean 1440 x 1080 viewport images. Long
marketing sections become top, middle, and lower viewport captures instead of
being compressed into a card.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGINALS = os.path.join(ROOT, "scripts", "original-seeds.json")
HARVEST = os.path.join(ROOT, "scripts", "mobbin-data.json")
MANIFEST = os.path.join(ROOT, "scripts", "seed-manifest.json")
CACHE = os.path.join(ROOT, "scripts", ".cache", "restored")
PUBLIC = os.path.join(ROOT, "public", "screens", "restored")
TARGET = os.path.join(ROOT, "src", "lib", "storage", "seed-examples.ts")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122 Safari/537.36"
SEED_REVISION = "2026-08-full-library-3"


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def asset_key(url: str) -> str:
    base = url.split("?")[0].rstrip("/")
    # Mobbin's signed flow images all use the path ``file.webp``; the ``enc``
    # signature is the image identity, so dropping the query collapses a whole
    # flow into one frame.
    if base.endswith("/file.webp"):
        return url
    return base.rsplit("/", 1)[-1]


def ts(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def download(url: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".image")
    if os.path.exists(path) and os.path.getsize(path) > 500:
        return path
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=90) as response:
        body = response.read()
    if len(body) < 500:
        raise RuntimeError(f"Image response was too small: {url}")
    with open(path, "wb") as handle:
        handle.write(body)
    return path


def viewport_capture(job: tuple[str, str, str]) -> str:
    """Create a top-fit viewport or a meaningful long-page crop."""
    url, output, position = job
    source = download(url)
    os.makedirs(os.path.dirname(output), exist_ok=True)
    if position == "fit":
        # Keep the desktop viewport's natural aspect. White padding here
        # showed up as a leftover plate under laptop thumbnails.
        video_filter = "scale=1440:1080:force_original_aspect_ratio=decrease"
    else:
        y = {
            "top": "0",
            "center": "(ih-oh)/2",
            "bottom": "ih-oh",
        }[position]
        video_filter = f"scale=1440:-2,crop=1440:1080:0:{y}"
    subprocess.run(
        [
            "ffmpeg",
            "-loglevel",
            "error",
            "-y",
            "-i",
            source,
            "-vf",
            video_filter,
            "-frames:v",
            "1",
            "-c:v",
            "libwebp",
            "-quality",
            "76",
            output,
        ],
        check=True,
    )
    return output


def categories_for(original: dict, metadata: dict, flow_audit: dict | None) -> list[str]:
    original_category = original["collection"]
    platform = metadata.get("platform")
    patterns = set(metadata.get("screenPatterns") or metadata.get("pagePatterns") or [])
    elements = set(metadata.get("screenElements") or [])

    if original_category == "Mobile Apps":
        categories = ["Mobile Apps"]
    elif original_category == "Web":
        categories = ["Web"]
        if "Dashboard" in patterns or "Charts" in patterns:
            categories.append("Dashboards")
    elif original_category == "Dashboards":
        categories = ["Web", "Dashboards"]
    elif original_category == "Onboarding":
        categories = ["Mobile Apps" if platform == "ios" else "Web", "Onboarding"]
        if flow_audit and "Landing Pages" in flow_audit.get("collections", []):
            categories.append("Landing Pages")
    elif original_category == "Navigation":
        categories = ["Mobile Apps", "Navigation"]
    elif original_category == "Typography":
        categories = ["Web", "Landing Pages", "Typography"]
    elif original_category == "Motion":
        categories = ["Mobile Apps", "Motion"]
    elif original_category == "Branding":
        categories = ["Web", "Branding"]
        if "Dashboard" in patterns or "Charts" in patterns:
            categories.append("Dashboards")
        name = (metadata.get("name") or original["title"]).lower()
        if "homepage" in name or "landing page" in name:
            categories.append("Landing Pages")
    else:
        categories = [original_category]

    # Keep the original conceptual category when its content evidence supports it.
    if original_category == "Navigation" and not (
        {"Tab Bar", "Top Navigation Bar", "Toolbar"} & elements
    ):
        categories.remove("Navigation")
    return list(dict.fromkeys(categories))


def build_references() -> tuple[list[dict], list[dict]]:
    originals = json.load(open(ORIGINALS))
    harvested = {row["url"]: row for row in json.load(open(HARVEST))}
    flow_manifest = {
        row["sourceUrl"]: row
        for row in json.load(open(MANIFEST))
        if row.get("kind") == "flow"
    }

    seen_images: set[str] = set()
    retired_duplicates: list[dict] = []
    references: list[dict] = []
    viewport_jobs: list[tuple[str, str, str]] = []

    for original in originals:
        if original["imageUrl"] in seen_images:
            retired_duplicates.append(original)
            continue
        seen_images.add(original["imageUrl"])

        metadata = harvested[original["url"]]
        flow = flow_manifest.get(original["url"])
        key = "original-" + slug(original["url"].rstrip("/").rsplit("/", 1)[-1])
        platform = metadata.get("platform")
        is_web = platform == "web" or metadata.get("kind") == "section"
        screens: list[dict] = []

        if flow:
            used: set[str] = set()
            for screen in flow["screens"]:
                remote = screen.get("remote") or screen.get("src")
                image_id = asset_key(remote)
                if image_id in used:
                    continue
                used.add(image_id)
                if is_web:
                    output = os.path.join(PUBLIC, key, f"{len(screens) + 1:02d}.webp")
                    viewport_jobs.append((remote, output, "fit"))
                    src = "/" + os.path.relpath(output, os.path.join(ROOT, "public"))
                else:
                    src = screen["src"]
                screens.append({"src": src, "label": f"Flow screen {len(screens) + 1}"})

            original_id = asset_key(original["imageUrl"])
            if original_id not in used:
                if is_web:
                    output = os.path.join(PUBLIC, key, f"{len(screens) + 1:02d}.webp")
                    viewport_jobs.append((original["imageUrl"], output, "fit"))
                    src = "/" + os.path.relpath(output, os.path.join(ROOT, "public"))
                else:
                    src = original["imageUrl"]
                screens.append({"src": src, "label": "Original reference"})
        elif metadata.get("kind") == "section":
            for position, label in (
                ("top", "Top viewport"),
                ("center", "Middle viewport"),
                ("bottom", "Lower viewport"),
            ):
                output = os.path.join(PUBLIC, key, f"{len(screens) + 1:02d}.webp")
                viewport_jobs.append((original["imageUrl"], output, position))
                src = "/" + os.path.relpath(output, os.path.join(ROOT, "public"))
                screens.append({"src": src, "label": label})
        elif is_web:
            output = os.path.join(PUBLIC, key, "01.webp")
            viewport_jobs.append((original["imageUrl"], output, "fit"))
            src = "/" + os.path.relpath(output, os.path.join(ROOT, "public"))
            screens.append({"src": src, "label": "Desktop viewport"})
        else:
            screens.append({"src": original["imageUrl"], "label": "Reference"})

        references.append(
            {
                "key": key,
                "title": original["title"],
                "url": original["url"],
                "collections": categories_for(original, metadata, flow),
                "screens": screens,
                "tags": original.get("tags", []),
                "notes": flow.get("notes", "") if flow else "",
                "source": "Mobbin",
                "aspect": "portrait" if platform == "ios" else "landscape",
            }
        )

    print(f"Rendering {len(viewport_jobs)} desktop viewport images…")
    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(viewport_capture, viewport_jobs))
    return references, retired_duplicates


def write_seed_file(references: list[dict]) -> None:
    lines = [
        "// Generated by scripts/build-seed-data.py - do not edit by hand.",
        "// Restores the original library; only genuine flows and long pages have carousels.",
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
        '  aspect: "portrait" | "landscape";',
        "}",
        "",
        f"export const SEED_REVISION = {ts(SEED_REVISION)};",
        "",
        "export const EXAMPLE_SEEDS: ExampleSeed[] = [",
    ]
    for reference in references:
        lines.extend(
            [
                "  {",
                f"    key: {ts(reference['key'])},",
                f"    title: {ts(reference['title'])},",
                f"    url: {ts(reference['url'])},",
                "    collections: ["
                + ", ".join(ts(value) for value in reference["collections"])
                + "],",
                "    screens: [",
            ]
        )
        for screen in reference["screens"]:
            lines.append(
                f"      {{ src: {ts(screen['src'])}, label: {ts(screen['label'])} }},"
            )
        lines.extend(
            [
                "    ],",
                "    tags: [" + ", ".join(ts(value) for value in reference["tags"]) + "],",
                f"    notes: {ts(reference['notes'])},",
                f"    source: {ts(reference['source'])},",
                f"    aspect: {ts(reference['aspect'])},",
                "  },",
            ]
        )
    lines.extend(["];", ""])
    with open(TARGET, "w") as handle:
        handle.write("\n".join(lines))


def main() -> int:
    references, retired = build_references()
    write_seed_file(references)
    print(f"Wrote {len(references)} references to {TARGET}")
    print(f"Retired {len(retired)} exact duplicate images:")
    for row in retired:
        print(f"  {row['url']}")
    print(
        "Single-image:",
        sum(len(row["screens"]) == 1 for row in references),
        "Multi-image:",
        sum(len(row["screens"]) > 1 for row in references),
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
