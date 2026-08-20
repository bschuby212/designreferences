#!/usr/bin/env python3
"""Check whether a section capture contains enough genuinely different states.

Sections are short video captures of a marketing page. A capture is only useful
as carousel content if it contains at least three frames that differ
meaningfully - three near-identical frames of the same hero would be padding.
Distinctness is measured with SSIM: a candidate frame is kept only when it is
dissimilar to every frame already kept.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, "scripts", ".cache", "sections")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36"
SSIM_MAX = 0.94  # below this, two frames are considered different states
CANDIDATES = 12


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def ssim(a: str, b: str) -> float:
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", a, "-i", b, "-lavfi", "ssim=stats_file=-", "-f", "null", "-"],
        capture_output=True,
        text=True,
    )
    match = re.search(r"All:([0-9.]+)", proc.stdout)
    return float(match.group(1)) if match else 0.0


def probe(record: dict) -> dict:
    name = slug(record["title"])
    folder = os.path.join(WORK, name)
    os.makedirs(folder, exist_ok=True)
    video = os.path.join(folder, "capture.mp4")
    if not os.path.exists(video):
        request = urllib.request.Request(record["cdnVideoUrl"], headers={"User-Agent": UA})
        with urllib.request.urlopen(request, timeout=90) as response:
            with open(video, "wb") as handle:
                handle.write(response.read())

    duration = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video],
        capture_output=True,
        text=True,
    ).stdout.strip()
    seconds = float(duration or 0) or 1.0

    for existing in os.listdir(folder):
        if existing.startswith("cand"):
            os.remove(os.path.join(folder, existing))
    subprocess.run(
        ["ffmpeg", "-v", "error", "-i", video, "-vf",
         f"fps={CANDIDATES / seconds:.4f},scale=720:-1", "-frames:v", str(CANDIDATES),
         os.path.join(folder, "cand%02d.png"), "-y"],
        check=False,
    )
    frames = sorted(f for f in os.listdir(folder) if f.startswith("cand"))
    # Skip the opening frames: captures often start mid-animation with a
    # half-rendered page, which is not a usable screen.
    frames = frames[1:]

    kept: list[str] = []
    for frame in frames:
        path = os.path.join(folder, frame)
        if all(ssim(path, os.path.join(folder, k)) < SSIM_MAX for k in kept):
            kept.append(frame)
    return {
        "title": record["title"],
        "pageUrl": record.get("pageUrl"),
        "patterns": record.get("sectionPatterns"),
        "seconds": round(seconds, 2),
        "candidates": len(frames),
        "distinct": len(kept),
        "kept": kept,
        "folder": folder,
    }


def main() -> int:
    data = json.load(open(os.path.join(ROOT, "scripts", "mobbin-data.json")))
    sections = [r for r in data if r["kind"] == "section" and r.get("cdnVideoUrl")]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(probe, sections))
    results.sort(key=lambda r: -r["distinct"])
    for r in results:
        print(f"  {r['distinct']:>2} distinct / {r['candidates']:>2}  {r['seconds']:>5}s  "
              f"{r['title']:<26} {r['pageUrl']}")
    usable = [r for r in results if r["distinct"] >= 3]
    print(f"\nsections with >=3 distinct states: {len(usable)} of {len(results)}")
    with open(os.path.join(ROOT, "scripts", "section-frames.json"), "w") as handle:
        json.dump(results, handle, indent=1)
    return 0


if __name__ == "__main__":
    sys.exit(main())
