#!/usr/bin/env python3
"""Reclassify EXAMPLE_SEEDS with exclusive collection rules. Additive catalog rewrite only."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TS_PATH = ROOT / "src/lib/storage/seed-examples.ts"
JSON_PATH = ROOT / "scripts/mobbin-seeds.json"

PLAYABLE = re.compile(r"\.(mp4|webm|mov|m4v|gif)(\?|$)", re.I)
PHONE = re.compile(r"/content/app_screens/|mobbin\.com/(?:explore/)?flows/", re.I)
WEB_PRODUCT = re.compile(r"/content/sites/", re.I)
MARKETING = re.compile(r"/(?:explore/)?sections/", re.I)

DOC_NEEDLES = (
    "developer.apple.com/design",
    "developer.apple.com/sf-symbols",
    "m3.material.io",
    "material.io",
    "ionicframework.com/docs",
    "reactnative.dev/docs",
    "docs.expo.dev",
    "tokens.studio",
    "heroicons.com",
    "ionic.io/ionicons",
    "phosphoricons.com",
    "capacitorjs.com",
    "ui.shadcn.com",
    "radix-ui.com",
    "carbondesignsystem.org",
    "carbondesignsystem.com",
    "polaris.shopify.com",
    "atlassian.design",
    "fluent2.microsoft.design",
    "spectrum.adobe.com",
    "ant.design",
    "mui.com",
    "chakra-ui.com",
    "daisyui.com",
    "tailwindui.com",
    "tailwindcss.com/docs",
    "getbootstrap.com",
    "ios.design",
    "mobile-patterns.com",
    "pttrns.com",
    "screenlane.com",
    "pageflows.com",
    "refero.design",
    "uisources.com",
    "ui-patterns.com",
    "uxpatterns.dev",
    "component.gallery",
    "untitledui.com",
    "lucide.dev",
    "lawsofux.com",
    "www.w3.org/wai",
    "styled-system.com",
)

ORDER = [
    "Mobile Apps",
    "Product Design",
    "Website",
    "Onboarding",
    "Navigation",
    "Motion",
]

SEED_RE = re.compile(
    r'\{ collection: "(?P<collection>[^"]+)", title: "(?P<title>(?:\\.|[^"\\])*)", '
    r'url: "(?P<url>[^"]+)", imageUrl: "(?P<imageUrl>[^"]+)"(?P<extra>[^}]*)\}',
)


def unescape(value: str) -> str:
    return value.replace('\\"', '"').replace("\\\\", "\\")


def parse_seeds(text: str) -> list[dict]:
    items: list[dict] = []
    for match in SEED_RE.finditer(text):
        extra = match.group("extra")
        video = re.search(r'videoUrl: "([^"]*)"', extra)
        notes = re.search(r'notes: "((?:\\.|[^"\\])*)"', extra)
        source = re.search(r'source: "([^"]*)"', extra)
        tags_m = re.search(r"tags: (\[[^\]]*\])", extra)
        try:
            tags = json.loads(tags_m.group(1)) if tags_m else []
        except json.JSONDecodeError:
            tags = []
        items.append(
            {
                "collection": match.group("collection"),
                "title": unescape(match.group("title")),
                "url": match.group("url"),
                "imageUrl": match.group("imageUrl"),
                "tags": tags,
                **({"videoUrl": video.group(1)} if video else {}),
                **({"notes": unescape(notes.group(1))} if notes else {}),
                **({"source": source.group(1)} if source else {}),
            }
        )
    return items


def is_playable(seed: dict) -> bool:
    for url in (seed.get("videoUrl"), seed.get("imageUrl")):
        if url and PLAYABLE.search(url):
            return True
    return False


def is_docs(url: str) -> bool:
    lower = url.lower()
    return any(needle in lower for needle in DOC_NEEDLES)


def collection_for(seed: dict) -> str | None:
    if is_playable(seed):
        return "Motion"
    if seed["collection"] == "Motion":
        return None
    if is_docs(seed["url"]):
        return None
    hay = f"{seed['url']} {seed['imageUrl']}"
    phone = bool(PHONE.search(hay))
    web_product = bool(WEB_PRODUCT.search(hay))
    marketing = bool(MARKETING.search(hay))
    claimed = seed["collection"]
    if claimed == "Onboarding" and (phone or "/flows/" in seed["url"]):
        return "Onboarding"
    if claimed == "Navigation" and phone:
        return "Navigation"
    if phone:
        return "Mobile Apps"
    if marketing:
        return "Website"
    if claimed in {"Website", "Marketing", "Branding", "Typography", "Web"}:
        return "Website"
    if web_product:
        return "Product Design"
    if claimed == "Product Design":
        return "Website"
    if claimed == "Mobile Apps":
        return None
    return "Website"


def ts_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def write_catalog(seeds: list[dict], retired: list[str]) -> None:
    grouped: dict[str, list[dict]] = {name: [] for name in ORDER}
    extra: list[dict] = []
    for item in seeds:
        if item["collection"] in grouped:
            grouped[item["collection"]].append(item)
        else:
            extra.append(item)
    ordered = [item for name in ORDER for item in grouped[name]] + extra
    counts = {}
    for item in ordered:
        counts[item["collection"]] = counts.get(item["collection"], 0) + 1

    JSON_PATH.write_text(json.dumps({"counts": counts, "seeds": ordered}, indent=2) + "\n")

    lines = [
        "export interface ExampleSeed {",
        "  collection: string;",
        "  title: string;",
        "  url: string;",
        "  imageUrl: string;",
        "  imageUrls?: string[];",
        "  videoUrl?: string;",
        "  tags: string[];",
        "  notes?: string;",
        "  source?: string;",
        "}",
        "",
        "export const RETIRED_SEED_URLS: string[] = [",
    ]
    for url in retired:
        lines.append(f'  "{url}",')
    lines.append("];")
    lines.append("")
    lines.append("export const EXAMPLE_SEEDS: ExampleSeed[] = [")
    current = None
    for item in ordered:
        if item["collection"] != current:
            if current is not None:
                lines.append("")
            current = item["collection"]
            lines.append(f"  // {current}")
        extra_fields = ""
        if item.get("videoUrl"):
            extra_fields += f', videoUrl: "{item["videoUrl"]}"'
        tags = json.dumps(item.get("tags") or [])
        if item.get("notes"):
            extra_fields += f', notes: "{ts_escape(item["notes"])}"'
        if item.get("source"):
            extra_fields += f', source: "{ts_escape(item["source"])}"'
        lines.append(
            "  { "
            f'collection: "{item["collection"]}", title: "{ts_escape(item["title"])}", '
            f'url: "{item["url"]}", imageUrl: "{item["imageUrl"]}", tags: {tags}'
            f"{extra_fields} }},"
        )
    lines.append("];")
    lines.append("")
    TS_PATH.write_text("\n".join(lines))
    print("counts", counts, "n=", len(ordered), "retired", len(retired))
    print("wrote", TS_PATH)
    print("wrote", JSON_PATH)


def existing_retired(text: str) -> list[str]:
    return re.findall(r'"(https://[^"]+)"', text.split("export const EXAMPLE_SEEDS")[0])


def main() -> None:
    text = TS_PATH.read_text()
    seeds = parse_seeds(text)
    retired = existing_retired(text)
    kept: list[dict] = []
    seen_url: set[str] = set()
    seen_img: set[str] = set()
    moved: dict[str, int] = {}
    dropped = 0
    for seed in seeds:
        nxt = collection_for(seed)
        if nxt is None:
            retired.append(seed["url"])
            dropped += 1
            continue
        if seed["url"] in seen_url or seed["imageUrl"] in seen_img:
            retired.append(seed["url"])
            dropped += 1
            continue
        if nxt != seed["collection"]:
            key = f"{seed['collection']}->{nxt}"
            moved[key] = moved.get(key, 0) + 1
        seed["collection"] = nxt
        seen_url.add(seed["url"])
        seen_img.add(seed["imageUrl"])
        kept.append(seed)

    unique_retired = list(dict.fromkeys(retired))
    write_catalog(kept, unique_retired)
    print("dropped", dropped)
    print("moved", moved)


if __name__ == "__main__":
    main()
