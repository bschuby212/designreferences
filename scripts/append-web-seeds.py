#!/usr/bin/env python3
"""Append Awwwards / web landing-page and navigation seeds. Additive only."""

from __future__ import annotations

import importlib.util
import json
import re
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = Path(__file__).resolve().parent / "awwwards-web-candidates.json"
JSON_PATH = ROOT / "scripts/mobbin-seeds.json"
SCRAPE = Path(__file__).resolve().parent / "scrape-mobbin-seeds.py"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
TARGET = 50


def load_writer():
    spec = importlib.util.spec_from_file_location("mobbin_scrape", SCRAPE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.write_output, module.unique_seeds, module.load_existing_seeds


def fetch(url: str, timeout: int = 12) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def og_image(html: str, page: str) -> str:
    match = re.search(
        r'property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', html, re.I
    ) or re.search(
        r'content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html, re.I
    )
    if not match:
        return ""
    raw = unescape(match.group(1)).strip()
    try:
        return urllib.parse.urljoin(page, raw)
    except Exception:
        return raw


def mshot(url: str) -> str:
    return f"https://s.wordpress.com/mshots/v1/{urllib.parse.quote(url, safe='')}?w=1200"


def resolve_image(url: str) -> str:
    try:
        html = fetch(url)
        image = og_image(html, url)
        if image and not re.search(r"/og(?:_image)?\.png(?:\?|$)", image, re.I):
            return image
    except Exception:
        pass
    return mshot(url)


def scrape_awwwards(limit: int = 80) -> list[dict]:
    pages = [
        "https://www.awwwards.com/websites/sites_of_the_day/",
        "https://www.awwwards.com/websites/web-design/",
        "https://www.awwwards.com/websites/navigation/",
        "https://www.awwwards.com/websites/",
    ]
    found: list[dict] = []
    seen: set[str] = set()
    for page in pages:
        try:
            html = fetch(page, timeout=10)
        except Exception as exc:
            print("awwwards skip", page, exc)
            continue
        for href, name in re.findall(
            r'href="(https?://www\.awwwards\.com/sites/[^"]+)"[^>]*>\s*([^<]{2,80})',
            html,
        ):
            slug = href.rstrip("/")
            if slug in seen:
                continue
            seen.add(slug)
            title = unescape(re.sub(r"\s+", " ", name)).strip()
            if not title:
                continue
            found.append(
                {
                    "title": title,
                    "url": slug,
                    "tags": ["awwwards", "landing"],
                    "notes": "Awwwards site of note. Open for tech tags, jury notes, and the live URL.",
                    "source": "Awwwards",
                    "collection": "Marketing",
                }
            )
            if len(found) >= limit:
                return found
    return found


def as_seed(collection: str, item: dict, image: str) -> dict:
    tags = list(dict.fromkeys(item.get("tags") or []))
    return {
        "collection": collection,
        "title": item["title"],
        "url": item["url"],
        "imageUrl": image,
        "tags": tags,
        "notes": item.get("notes") or "",
        "source": item.get("source") or "Awwwards",
    }


def pick(
    collection: str,
    candidates: list[dict],
    seeds: list[dict],
    seen_urls: set[str],
    seen_imgs: set[str],
    seen_titles: set[str],
) -> int:
    filtered = []
    for item in candidates:
        url = item["url"]
        title_key = f"{collection}:{item['title'].lower()}"
        if url in seen_urls or title_key in seen_titles:
            continue
        filtered.append(item)

    print(f"  resolving {len(filtered)} {collection} candidates")
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(resolve_image, item["url"]): item for item in filtered}
        for future in as_completed(futures):
            futures[future]["imageUrl"] = future.result()

    added = 0
    for item in filtered:
        if added >= TARGET:
            break
        image = item.get("imageUrl") or ""
        if not image or item["url"] in seen_urls or image in seen_imgs:
            continue
        title_key = f"{collection}:{item['title'].lower()}"
        if title_key in seen_titles:
            continue
        seed = as_seed(collection, item, image)
        seeds.append(seed)
        seen_urls.add(seed["url"])
        seen_imgs.add(seed["imageUrl"])
        seen_titles.add(title_key)
        added += 1
    return added


def main() -> None:
    write_output, unique_seeds, load_existing_seeds = load_writer()
    seeds = unique_seeds(load_existing_seeds())
    seen_urls = {item["url"] for item in seeds}
    seen_imgs = {item["imageUrl"] for item in seeds}
    seen_titles = {f"{item['collection']}:{item['title'].lower()}" for item in seeds}
    before = {name: sum(1 for item in seeds if item["collection"] == name) for name in ("Marketing", "Navigation")}
    print("have", before)

    data = json.loads(CANDIDATES.read_text())
    live = scrape_awwwards()
    print("live awwwards", len(live))

    marketing = live + data["marketing"]
    navigation = data["navigation"]

    added_m = pick("Marketing", marketing, seeds, seen_urls, seen_imgs, seen_titles)
    added_n = pick("Navigation", navigation, seeds, seen_urls, seen_imgs, seen_titles)
    print(f"added Marketing +{added_m}, Navigation +{added_n}")

    write_output(seeds)


if __name__ == "__main__":
    main()
