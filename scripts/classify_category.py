"""Canonical gallery classification shared by the seed builder and remapper."""

from __future__ import annotations

import json
import re
from copy import deepcopy
from typing import Any

CANONICAL = [
    "Mobile Apps",
    "Web & Landing Pages",
    "Dashboards",
    "Mobile Onboarding",
    "Web Sign-Up",
    "Mobile Navigation",
]
HIDDEN = ["Typography", "Motion", "Branding"]
OBSOLETE = ["Web", "Landing Pages", "Onboarding", "Navigation"]
SEED_REVISION = "2026-08-canonical-categories-1"

SIGNUP = re.compile(
    r"\b(sign[ -]?up|sign[ -]?in|log[ -]?in|log[ -]?on|register|registration|"
    r"password|verification|verify|auth|account setup|create account|invitation|"
    r"trial|workspace creation|email inputted|pre-filled (?:login|form)|"
    r"onboarding checklist|creation options)\b",
    re.I,
)
DASHBOARD = re.compile(
    r"\b(dashboard|analytics|reporting|admin|kpi|metrics|overview|"
    r"companies list|my apps|user dashboard|data ingestion|chat start|"
    r"populated video)\b",
    re.I,
)
LANDING = re.compile(
    r"\b(landing page|homepage|home page|marketing|hero|pricing|"
    r"testimonial|feature section|plan comparison)\b",
    re.I,
)
ONBOARDING = re.compile(
    r"\b(onboarding|welcome|permission|personalization|goal selection|"
    r"profile setup|first[ -]?use|get started|set up|setup)\b",
    re.I,
)
NAV = re.compile(r"\b(tab bar|bottom nav|drawer|navigation|menu)\b", re.I)

WEB_ONBOARDING_SPLITS = {
    "original-ab8dcea1-9830-43e8-9487-fe6ce5910c84": "landing-signup-dashboard",  # Rox
    "original-e064f4d1-4ee1-4748-ba66-f2172caa277d": "landing-signup-dashboard",  # Maze
    "original-242ff3d6-866e-4a34-87eb-715354f9d45f": "landing-signup",  # Navattic
    "original-0c3206ce-2ec1-4408-8a00-24190ec7651d": "landing-signup-dashboard",  # Copy.ai
    "original-ec2d5551-50bd-45c9-be09-b5a84a3f6605": "landing-signup",  # Shop
    "original-7f996659-bee1-4760-b1e2-7918e3816f20": "landing-signup-dashboard",  # Dialpad
    "original-808643f4-122e-40a8-9b14-bc25c7379c34": "landing-signup-dashboard",  # Runway
}
WEB_ONBOARDING_SIGNUP_ONLY = {
    "original-950c4839-2b7d-4a9e-9e15-52b1c5e77769",  # Manus
}

DASHBOARD_TITLE_OVERRIDES = {
    "PandaDoc Web Home Dashboard",
    "Attio Web Companies List",
    "OpenSea Web Trending Collections",
    "Remote Web User Dashboard View",
    "Deel Web User Dashboard",
    "Origin Web Financial Dashboard",
    "Sana AI Web Dashboard Home",
    "Deel Web Main Dashboard",
    "Notion Web Home Page Tasks",
    "Sana AI Web Assistant Homepage",
    "Jobber Web User dashboard",
    "Okta Web My Apps",
    "Mindtrip Web Chat Start",
    "Databricks Web Data Ingestion Page",
    "FLORA Web Populated Video Block",
}
LANDING_TITLE_OVERRIDES = {
    "Shopify Web Shopify Homepage",
    "Google Workspace Web Plan Comparison",
    "Nextdoor Web Nextdoor Homepage",
    "Depop Web E-commerce Landing Page",
    "HBO Max Web Content Homepage",
    "OpenSea Web OpenSea Landing Page",
    "Intercom Web Homepage",
    "Twitch Web Twitch Homepage",
    "Outseta Web Homepage",
}
SIGNUP_TITLE_OVERRIDES = {
    "Bonsai Web Onboarding Checklist",
    "Coinbase Web Account Setup Homepage",
    "Chronicle Web Chronicle Creation Options",
    "Krea AI Web Password Filled",
    "Front Web Valid password",
    "Lemni Web Pre-filled Login",
    "Jasper Web Pre-filled form",
    "v0 Web Email Inputted",
}

DASHBOARD_MERGE_PRODUCTS = {
    "Navattic",
    "Rox",
    "Maze",
    "Manus",
    "Hootsuite",
    "Substack",
    "Remote",
    "Deel",
    "Dialpad",
}
LANDING_MERGE_TITLES = {"Superpower section", "Ramp section"}


def uniq(names: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for name in names:
        if not name or name in seen:
            continue
        seen.add(name)
        out.append(name)
    return out


def exclusive(names: list[str]) -> list[str]:
    """Mobile Onboarding never also belongs to Mobile Apps."""
    unique = uniq(names)
    if "Mobile Onboarding" in unique:
        return [name for name in unique if name != "Mobile Apps"]
    return unique


def product_name(title: str) -> str:
    return re.sub(r"\s+(iOS|Web|section)\b.*$", "", title, flags=re.I).strip() or title


def platform_of(title: str, aspect: str | None, platform: str | None) -> str:
    if platform in {"ios", "android"}:
        return "ios"
    if platform == "web":
        return "web"
    if aspect == "portrait":
        return "ios"
    if aspect == "landscape":
        return "web"
    if re.search(r"\bios\b", title, re.I):
        return "ios"
    if re.search(r"\bweb\b", title, re.I):
        return "web"
    return "unknown"


def categories_for(original: dict, metadata: dict, flow_audit: dict | None = None) -> list[str]:
    original_category = original.get("collection") or ""
    title = metadata.get("name") or original.get("title") or ""
    notes = (flow_audit or {}).get("notes") or ""
    platform = platform_of(title, None, metadata.get("platform"))
    text = f"{title} {notes}"
    hidden = [original_category] if original_category in HIDDEN else []

    if original_category == "Motion":
        return exclusive(["Mobile Apps", "Motion"])
    if original_category in {"Navigation", "Mobile Navigation"}:
        return exclusive(["Mobile Apps", "Mobile Navigation", *hidden])
    if original_category == "Mobile Onboarding" or (
        original_category == "Onboarding" and platform != "web"
    ) or (platform != "web" and ONBOARDING.search(text)):
        return exclusive(["Mobile Onboarding", *hidden])
    if original_category == "Onboarding" and platform == "web":
        return exclusive(["Web Sign-Up", *hidden])
    if original_category == "Dashboards":
        return exclusive(["Dashboards", *hidden])
    if original_category in {"Landing Pages", "Typography", "Web & Landing Pages"}:
        extra = ["Typography"] if original_category == "Typography" else []
        return exclusive(["Web & Landing Pages", *extra, *hidden])
    if original_category == "Mobile Apps":
        if ONBOARDING.search(text) and platform != "web":
            return exclusive(["Mobile Onboarding", *hidden])
        return exclusive(["Mobile Apps", *hidden])

    if platform == "ios":
        if ONBOARDING.search(text):
            return exclusive(["Mobile Onboarding", *hidden])
        if NAV.search(text):
            return exclusive(["Mobile Apps", "Mobile Navigation", *hidden])
        return exclusive(["Mobile Apps", *hidden])

    if title in SIGNUP_TITLE_OVERRIDES or SIGNUP.search(text):
        return exclusive(["Web Sign-Up", *hidden])
    if title in DASHBOARD_TITLE_OVERRIDES or DASHBOARD.search(text):
        return exclusive(["Dashboards", *hidden])
    if title in LANDING_TITLE_OVERRIDES or LANDING.search(text):
        if re.search(r"\baccount setup\b", text, re.I):
            return exclusive(["Web Sign-Up", *hidden])
        return exclusive(["Web & Landing Pages", *hidden])

    if original_category in {"Web", "Branding"} or platform == "web":
        if SIGNUP.search(title):
            return exclusive(["Web Sign-Up", *hidden])
        if LANDING.search(title):
            return exclusive(["Web & Landing Pages", *hidden])
        return exclusive(["Dashboards", *hidden])

    return exclusive(["Web & Landing Pages", *hidden])


def classify_seed(ref: dict[str, Any]) -> list[str]:
    previous = list(ref.get("collections") or [])
    title = ref.get("title") or ""
    notes = ref.get("notes") or ""
    tags = " ".join(ref.get("tags") or [])
    aspect = ref.get("aspect")
    platform = platform_of(title, aspect, None)
    hidden = [name for name in previous if name in HIDDEN]
    text = f"{title} {notes} {tags}"

    if "Motion" in previous:
        return exclusive(["Mobile Apps", "Motion"])
    if "Navigation" in previous or "Mobile Navigation" in previous:
        return exclusive(["Mobile Apps", "Mobile Navigation"])
    if "Mobile Onboarding" in previous or (
        "Onboarding" in previous and platform != "web"
    ) or (platform != "web" and ONBOARDING.search(text)):
        return exclusive(["Mobile Onboarding", *hidden])
    if "Onboarding" in previous and platform == "web":
        return exclusive(["Web Sign-Up"])
    if "Landing Pages" in previous or "Typography" in previous or "Web & Landing Pages" in previous:
        return exclusive(["Web & Landing Pages", *hidden])
    if title in SIGNUP_TITLE_OVERRIDES:
        return exclusive(["Web Sign-Up", *hidden])
    if title in DASHBOARD_TITLE_OVERRIDES:
        return exclusive(["Dashboards", *hidden])
    if title in LANDING_TITLE_OVERRIDES:
        return exclusive(["Web & Landing Pages", *hidden])
    if "Dashboards" in previous:
        return exclusive(["Dashboards", *hidden])
    if "Mobile Apps" in previous:
        return exclusive(["Mobile Apps", *hidden])

    if SIGNUP.search(text):
        return exclusive(["Web Sign-Up", *hidden])
    if DASHBOARD.search(text):
        return exclusive(["Dashboards", *hidden])
    if LANDING.search(text):
        return exclusive(["Web & Landing Pages", *hidden])
    if platform == "web":
        return exclusive(["Dashboards", *hidden])
    return exclusive(["Web & Landing Pages", *hidden])


def _drop_original_reference(screens: list[dict]) -> list[dict]:
    if len(screens) > 1 and screens[-1].get("label") == "Original reference":
        return screens[:-1]
    return screens


def _relabel(screens: list[dict], prefix: str) -> list[dict]:
    out = []
    for index, screen in enumerate(screens, start=1):
        cloned = dict(screen)
        cloned["label"] = f"{prefix} {index}"
        out.append(cloned)
    return out


def _split_web_onboarding(ref: dict[str, Any], mode: str) -> tuple[list[dict], list[dict]]:
    screens = _drop_original_reference(list(ref["screens"]))
    company = product_name(ref["title"])
    created: list[dict] = []
    audit: list[dict] = []
    landing_screens = screens[:1]
    rest = screens[1:]
    dashboard_screens: list[dict] = []
    signup_screens = rest
    if mode == "landing-signup-dashboard" and rest:
        dashboard_screens = rest[-1:]
        signup_screens = rest[:-1]

    landing = deepcopy(ref)
    landing["key"] = f"{ref['key']}-landing"
    landing["title"] = f"{company} Web Landing Page"
    landing["url"] = ref["url"] + "#landing"
    landing["collections"] = ["Web & Landing Pages"]
    landing["screens"] = _relabel(landing_screens, "Landing screen")
    landing["notes"] = f"Marketing homepage split from {ref['title']}."
    landing["tags"] = uniq([*(ref.get("tags") or []), "landing"])
    created.append(landing)
    audit.append(
        {
            "id": landing["key"],
            "product": company,
            "platform": "web",
            "previous": list(ref.get("collections") or []),
            "final": landing["collections"],
            "reason": "split marketing homepage off a mixed web onboarding flow",
            "slideCount": len(landing["screens"]),
            "action": "split-landing",
            "whitespaceFix": "none",
        }
    )

    signup = deepcopy(ref)
    signup["title"] = f"{company} Web Sign-Up"
    signup["collections"] = ["Web Sign-Up"]
    signup["screens"] = _relabel(signup_screens or rest[:1] or screens[:1], "Sign-up screen")
    signup["notes"] = f"Account-entry screens split from {ref['title']}."
    signup["tags"] = uniq([*(ref.get("tags") or []), "sign-up"])
    created.append(signup)
    audit.append(
        {
            "id": signup["key"],
            "product": company,
            "platform": "web",
            "previous": list(ref.get("collections") or []),
            "final": signup["collections"],
            "reason": "browser account-entry flow",
            "slideCount": len(signup["screens"]),
            "action": "split-signup",
            "whitespaceFix": "none",
        }
    )

    if dashboard_screens:
        dashboard = deepcopy(ref)
        dashboard["key"] = f"{ref['key']}-dashboard"
        dashboard["title"] = f"{company} Web Dashboard"
        dashboard["url"] = ref["url"] + "#dashboard"
        dashboard["collections"] = ["Dashboards"]
        dashboard["screens"] = _relabel(dashboard_screens, "Dashboard screen")
        dashboard["notes"] = f"Logged-in workspace split from {ref['title']}."
        dashboard["tags"] = uniq([*(ref.get("tags") or []), "dashboard"])
        created.append(dashboard)
        audit.append(
            {
                "id": dashboard["key"],
                "product": company,
                "platform": "web",
                "previous": list(ref.get("collections") or []),
                "final": dashboard["collections"],
                "reason": "workspace/dashboard frames removed from sign-up carousel",
                "slideCount": len(dashboard["screens"]),
                "action": "split-dashboard",
                "whitespaceFix": "css-padding",
            }
        )

    return created, audit


def recategorize_library(references: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    audit: list[dict[str, Any]] = []
    next_refs: list[dict[str, Any]] = []

    for ref in references:
        previous = list(ref.get("collections") or [])
        key = ref["key"]
        if key in WEB_ONBOARDING_SPLITS:
            created, rows = _split_web_onboarding(ref, WEB_ONBOARDING_SPLITS[key])
            next_refs.extend(created)
            audit.extend(rows)
            continue

        classified = classify_seed(ref)
        updated = deepcopy(ref)
        if key in WEB_ONBOARDING_SIGNUP_ONLY:
            classified = ["Web Sign-Up"]
            updated["screens"] = _drop_original_reference(updated["screens"])
            updated["title"] = f"{product_name(ref['title'])} Web Sign-Up"
        updated["collections"] = exclusive(classified)
        next_refs.append(updated)
        reason = "canonical remap"
        if classified != previous:
            reason = f"reclassified from {previous} by screen purpose"
        if "Dashboards" in classified:
            whitespace = "css-padding"
        else:
            whitespace = "none"
        audit.append(
            {
                "id": key,
                "product": product_name(ref["title"]),
                "platform": "ios" if ref.get("aspect") == "portrait" else "web",
                "previous": previous,
                "final": classified,
                "reason": reason,
                "slideCount": len(updated["screens"]),
                "action": "reclassify",
                "whitespaceFix": whitespace,
            }
        )

    merged: list[dict[str, Any]] = []
    consumed: set[str] = set()

    def absorb(group: list[dict[str, Any]], title: str, collections: list[str], action: str) -> dict[str, Any]:
        keep = deepcopy(group[0])
        screens: list[dict] = []
        seen_src: set[str] = set()
        for row in group:
            for screen in row["screens"]:
                if screen["src"] in seen_src:
                    continue
                seen_src.add(screen["src"])
                screens.append(dict(screen))
        keep["title"] = title
        keep["collections"] = collections
        keep["screens"] = _relabel(screens, "Screen")
        keep["notes"] = keep.get("notes") or f"Merged {len(group)} same-company captures."
        consumed.update(row["key"] for row in group[1:])
        for row in group[1:]:
            audit.append(
                {
                    "id": row["key"],
                    "product": product_name(row["title"]),
                    "platform": "web",
                    "previous": list(row.get("collections") or []),
                    "final": collections,
                    "reason": f"merged into {keep['key']}",
                    "slideCount": len(row["screens"]),
                    "action": action,
                    "whitespaceFix": "css-padding" if "Dashboards" in collections else "none",
                }
            )
        for row in audit:
            if row["id"] == keep["key"]:
                row["slideCount"] = len(keep["screens"])
                row["action"] = action
                row["final"] = collections
                row["reason"] = f"merged {len(group)} same-company captures"
        return keep

    landing_groups: dict[str, list[dict]] = {}
    for ref in next_refs:
        if ref["title"] not in LANDING_MERGE_TITLES:
            continue
        if "Web & Landing Pages" not in ref["collections"]:
            continue
        landing_groups.setdefault(ref["title"], []).append(ref)
    for title, group in landing_groups.items():
        if len(group) < 2:
            continue
        merged.append(absorb(group, title, ["Web & Landing Pages", "Typography"], "merge-landing"))

    dashboard_groups: dict[str, list[dict]] = {}
    for ref in next_refs:
        if "Dashboards" not in ref["collections"]:
            continue
        product = product_name(ref["title"])
        if product not in DASHBOARD_MERGE_PRODUCTS:
            continue
        dashboard_groups.setdefault(product, []).append(ref)
    for product, group in dashboard_groups.items():
        if len(group) < 2:
            continue
        title = f"{product} Web Dashboard"
        merged.append(absorb(group, title, ["Dashboards"], "merge-dashboard"))

    merged_keys = {ref["key"] for ref in merged}
    result = []
    for ref in next_refs:
        if ref["key"] in consumed:
            continue
        if ref["key"] in merged_keys:
            result.append(next(item for item in merged if item["key"] == ref["key"]))
            continue
        result.append(ref)

    visible_names = set(CANONICAL)
    for ref in result:
        cols = exclusive(ref["collections"])
        if "Mobile Apps" in cols and "Mobile Onboarding" in cols:
            raise RuntimeError(f"{ref['key']} cannot belong to Mobile Apps and Mobile Onboarding")
        ref["collections"] = cols
        for name in ref["collections"]:
            if name in OBSOLETE:
                raise RuntimeError(f"{ref['key']} still has obsolete category {name}")
        if not any(name in visible_names or name in HIDDEN for name in ref["collections"]):
            raise RuntimeError(f"{ref['key']} has no canonical category")

    return result, audit


def ts(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def write_seed_file(path: str, references: list[dict[str, Any]], revision: str = SEED_REVISION) -> None:
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
        f"export const SEED_REVISION = {ts(revision)};",
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
    with open(path, "w") as handle:
        handle.write("\n".join(lines))
