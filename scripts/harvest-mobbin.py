#!/usr/bin/env python3
"""Harvest authoritative metadata for the seeded Mobbin references.

The seed list in src/lib/storage/seed-examples.ts only carries a local label and
a single image. Those labels turned out to disagree with the actual content, so
categories are rebuilt from what Mobbin itself reports about each reference:

  screens  -> appName, platform, screenPatterns, screenElements, pagePatterns
  flows    -> the ordered screens that make up the flow (real carousel content)
  sections -> the marketing page the section was captured from

Responses are cached under scripts/.cache so re-runs are cheap.

Usage: python3 scripts/harvest-mobbin.py [--out scripts/mobbin-data.json]
"""

from __future__ import annotations

import argparse
import codecs
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "scripts", ".cache")
SEEDS = os.path.join(ROOT, "src", "lib", "storage", "seed-examples.ts")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36"

SEED_RE = re.compile(
    r'\{\s*collection:\s*"(?P<collection>[^"]+)",\s*'
    r'title:\s*"(?P<title>[^"]+)",\s*'
    r'url:\s*"(?P<url>[^"]+)",\s*'
    r'imageUrl:\s*"(?P<image>[^"]+)",\s*'
    r'tags:\s*\[(?P<tags>[^\]]*)\]'
)
CHUNK_RE = re.compile(r'self\.__next_f\.push\(\[1,\s*"((?:[^"\\]|\\.)*)"\]\)')


def fetch(url: str) -> str:
    key = hashlib.sha1(url.encode()).hexdigest() + ".html"
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            return handle.read()
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=45) as response:
        body = response.read().decode("utf-8", "ignore")
    os.makedirs(CACHE, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return body


def payload_of(html: str) -> str:
    """Flatten the streamed RSC chunks into one searchable string."""
    parts = []
    for chunk in CHUNK_RE.findall(html):
        try:
            parts.append(codecs.decode(chunk, "unicode_escape"))
        except Exception:
            continue
    return "".join(parts)


def enclosing_json(text: str, index: int):
    """Return the JSON object literal that contains `index`, parsed."""
    depth = 0
    i = index
    while i >= 0:
        if text[i] == "}":
            depth += 1
        elif text[i] == "{":
            if depth == 0:
                break
            depth -= 1
        i -= 1
    if i < 0:
        return None
    start = i
    depth = 0
    in_string = False
    escaped = False
    for j in range(start, len(text)):
        char = text[j]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : j + 1])
                except Exception:
                    return None
    return None


def enclosing_array(text: str, index: int):
    start = text.index("[", index)
    depth = 0
    in_string = False
    escaped = False
    for j in range(start, len(text)):
        char = text[j]
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "[":
            depth += 1
        elif char == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(text[start : j + 1])
                except Exception:
                    return None
    return None


def as_dict(value) -> dict:
    """RSC payloads substitute unresolved values with placeholder strings."""
    return value if isinstance(value, dict) else {}


def names(value):
    """screenPatterns et al arrive either as strings or {name, slug} objects."""
    out = []
    for item in value or []:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict) and item.get("name"):
            out.append(item["name"])
    return out


def best_src(sources: dict) -> str | None:
    if not isinstance(sources, dict):
        return None
    best = None
    best_width = -1
    for entry in sources.get("srcSet") or []:
        url = entry.get("url")
        descriptor = str(entry.get("descriptor") or "")
        match = re.match(r"(\d+)w", descriptor)
        width = int(match.group(1)) if match else 0
        if url and width > best_width:
            best, best_width = url, width
    return best or sources.get("src")


def parse_screen(payload: str) -> dict:
    """Primary screen metadata: the object that carries both app and patterns."""
    best = {}
    for match in re.finditer(r'"screenPatterns"', payload):
        obj = enclosing_json(payload, match.start())
        if not isinstance(obj, dict) or not obj.get("appName"):
            continue
        seo = as_dict(obj.get("seoContentMetadata"))
        candidate = {
            "appName": obj.get("appName"),
            "platform": obj.get("platform"),
            "appCategories": obj.get("appCategories") or [],
            "screenPatterns": names(obj.get("screenPatterns")),
            "screenElements": names(obj.get("screenElements")),
            "pagePatterns": names(obj.get("pagePatterns")),
            "name": seo.get("name"),
            "description": seo.get("description"),
            "width": obj.get("width"),
            "height": obj.get("height"),
        }
        if len(json.dumps(candidate)) > len(json.dumps(best)):
            best = candidate
    return best


def parse_flow(payload: str) -> dict:
    data = {"screens": []}
    match = re.search(r'"appSectionScreens"', payload)
    if match:
        for entry in enclosing_array(payload, match.start()) or []:
            screen = as_dict(as_dict(entry).get("appScreen"))
            url = best_src(as_dict(screen.get("screenCdnImgSources")))
            if not url:
                continue
            data["screens"].append(
                {
                    "order": entry.get("order", len(data["screens"])),
                    "id": screen.get("id"),
                    "url": url,
                    "width": screen.get("width"),
                    "height": screen.get("height"),
                }
            )
        data["screens"].sort(key=lambda item: item["order"])

    # App identity: the flow page repeats appName in unrelated widgets, so trust
    # the object that also names the platform or the flow itself.
    for key in ('"platform"', '"seoContentMetadata"'):
        for match in re.finditer(re.escape(key), payload):
            obj = enclosing_json(payload, match.start())
            if isinstance(obj, dict) and obj.get("appName"):
                seo = as_dict(obj.get("seoContentMetadata"))
                data.setdefault("appName", obj.get("appName"))
                data.setdefault("platform", obj.get("platform"))
                data.setdefault("appCategories", obj.get("appCategories") or [])
                data.setdefault("name", seo.get("name"))
                data.setdefault("description", seo.get("description"))
                data.setdefault("pagePatterns", names(obj.get("pagePatterns")))
                break
    return data


def parse_section(payload: str) -> dict:
    data = {}
    match = re.search(r'"page_url"\s*:\s*"([^"]+)"', payload)
    if match:
        data["pageUrl"] = match.group(1)
    match = re.search(r'"page_image_url"\s*:\s*"([^"]+)"', payload)
    if match:
        data["pageImageUrl"] = match.group(1)
    match = re.search(r'"page_video_url"\s*:\s*"([^"]+)"', payload)
    if match:
        data["pageVideoUrl"] = match.group(1)
    match = re.search(r'"sectionPatterns"', payload)
    if match:
        obj = enclosing_json(payload, match.start())
        if isinstance(obj, dict):
            data["sectionPatterns"] = names(obj.get("sectionPatterns"))
    # Supabase storage refuses direct reads, so keep the CDN copy of the capture.
    match = re.search(r'"cdnVideoSources"\s*:', payload)
    if match:
        obj = enclosing_json(payload, match.end())
        source = as_dict(as_dict(obj).get("source"))
        if source.get("url"):
            data["cdnVideoUrl"] = source["url"]
    return data


def load_seeds() -> list[dict]:
    text = open(SEEDS, encoding="utf-8").read()
    rows = []
    for match in SEED_RE.finditer(text):
        rows.append(
            {
                "collection": match.group("collection"),
                "title": match.group("title"),
                "url": match.group("url"),
                "imageUrl": match.group("image"),
                "tags": re.findall(r'"([^"]+)"', match.group("tags")),
            }
        )
    return rows


def harvest(seed: dict) -> dict:
    url = seed["url"]
    kind = (
        "flow"
        if "/flows/" in url
        else "section"
        if "/sections/" in url
        else "screen"
    )
    record = dict(seed, kind=kind)
    try:
        payload = payload_of(fetch(url))
    except Exception as error:  # network / 404
        record["error"] = str(error)
        return record
    if not payload:
        record["error"] = "empty payload"
        return record
    if kind == "flow":
        record.update(parse_flow(payload))
    elif kind == "section":
        record.update(parse_section(payload))
    else:
        record.update(parse_screen(payload))
    return record


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join(ROOT, "scripts", "mobbin-data.json"))
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    seeds = load_seeds()
    print(f"seeds: {len(seeds)}")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        records = list(pool.map(harvest, seeds))

    errors = [r for r in records if r.get("error")]
    print(f"harvested: {len(records)}  errors: {len(errors)}")
    for record in errors[:10]:
        print("  !", record["title"], record["error"])

    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(records, handle, indent=1, sort_keys=True)
    print("wrote", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
