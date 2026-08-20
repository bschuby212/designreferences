#!/usr/bin/env python3
"""Build one contact sheet per seeded reference for the categorisation audit.

Categories are decided by looking at the screens, not at the labels that came
with the seed data, so every reference gets a sheet showing all of its screens
side by side.

Usage: python3 scripts/make-audit-sheets.py [--out scripts/.cache/audit]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "scripts", "seed-manifest.json")


def sheet(reference: dict, out_dir: str) -> str | None:
    paths = [s["path"] for s in reference["screens"]]
    if not paths:
        return None
    height = 460 if reference["platform"] == "ios" else 300
    out = os.path.join(out_dir, f"{reference['key']}.png")
    args = ["ffmpeg", "-v", "error"]
    for path in paths:
        args += ["-i", path]
    scale = ";".join(
        f"[{i}:v]scale=-1:{height},pad=iw+8:ih:0:0:color=white[v{i}]" for i in range(len(paths))
    )
    inputs = "".join(f"[v{i}]" for i in range(len(paths)))
    args += ["-filter_complex", f"{scale};{inputs}hstack=inputs={len(paths)}[out]",
             "-map", "[out]", "-frames:v", "1", out, "-y"]
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        print("  ffmpeg failed", reference["key"], result.stderr[:200])
        return None
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=os.path.join(ROOT, "scripts", ".cache", "audit"))
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)

    references = json.load(open(MANIFEST))
    made = 0
    for reference in sorted(references, key=lambda r: (r["platform"], r["app"])):
        path = sheet(reference, args.out)
        if path:
            made += 1
            print(f"{reference['key']:<34} {reference['platform']:<4} "
                  f"{len(reference['screens'])} screens -> {path}")
    print(f"\n{made} sheets in {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
