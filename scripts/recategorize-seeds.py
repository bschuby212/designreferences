#!/usr/bin/env python3
"""Remap the generated seed file onto the six canonical canvases without re-rendering images."""

from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from classify_category import SEED_REVISION, recategorize_library, write_seed_file

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED = os.path.join(ROOT, "src", "lib", "storage", "seed-examples.ts")
AUDIT = os.path.join(ROOT, "scripts", "category-audit.json")


def parse_str_list(inner: str) -> list[str]:
    inner = inner.strip()
    if not inner:
        return []
    return json.loads("[" + inner + "]")


def parse_screens(inner: str) -> list[dict]:
    screens = []
    for src, label in re.findall(r"src: (.*?), label: (.*?) \},", inner, flags=re.S):
        screens.append({"src": json.loads(src), "label": json.loads(label)})
    return screens


def parse_seed_file(path: str) -> list[dict]:
    text = open(path).read()
    pattern = re.compile(
        r"  \{\n"
        r"    key: (?P<key>.*?),\n"
        r"    title: (?P<title>.*?),\n"
        r"    url: (?P<url>.*?),\n"
        r"    collections: \[(?P<collections>.*?)\],\n"
        r"    screens: \[(?P<screens>.*?)\],\n"
        r"    tags: \[(?P<tags>.*?)\],\n"
        r"    notes: (?P<notes>.*?),\n"
        r"    source: (?P<source>.*?),\n"
        r"    aspect: (?P<aspect>.*?),\n"
        r"  \},",
        re.S,
    )
    references = []
    for match in pattern.finditer(text):
        references.append(
            {
                "key": json.loads(match.group("key")),
                "title": json.loads(match.group("title")),
                "url": json.loads(match.group("url")),
                "collections": parse_str_list(match.group("collections")),
                "screens": parse_screens(match.group("screens")),
                "tags": parse_str_list(match.group("tags")),
                "notes": json.loads(match.group("notes")),
                "source": json.loads(match.group("source")),
                "aspect": json.loads(match.group("aspect")),
            }
        )
    return references


def main() -> int:
    previous = parse_seed_file(SEED)
    if not previous:
        raise SystemExit(f"Failed to parse seeds from {SEED}")
    references, audit = recategorize_library(previous)
    write_seed_file(SEED, references, SEED_REVISION)
    with open(AUDIT, "w") as handle:
        json.dump(audit, handle, indent=2)
        handle.write("\n")

    counts: dict[str, int] = {}
    for ref in references:
        for name in ref["collections"]:
            counts[name] = counts.get(name, 0) + 1
    print(f"Wrote {len(references)} references to {SEED}")
    print(f"Audit rows: {len(audit)} -> {AUDIT}")
    print(
        "Single-image:",
        sum(len(row["screens"]) == 1 for row in references),
        "Multi-image:",
        sum(len(row["screens"]) > 1 for row in references),
    )
    for name in sorted(counts):
        print(f"  {name}: {counts[name]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
