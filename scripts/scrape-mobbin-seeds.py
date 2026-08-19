#!/usr/bin/env python3
"""Pull 50 unique Mobbin references per library collection."""

from __future__ import annotations

import json
import re
import sys
import time
import http.client
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, unquote

TOKEN_PATH = Path.home() / ".mcp-auth/mcp-remote-0.1.37/a7d8737d8f664af65d45c9e72ead2c10_tokens.json"
CDN = "https://bytescale.mobbin.com/FW25bBB/image/mobbin.com/prod/content"
SKIP = re.compile(
    r"\b(log[\s-]?in|sign[\s-]?in|sign[\s-]?up|password|otp|verify|verification|2fa|"
    r"forgot|pricing|paywall|cookie|captcha|permission|unsubscribe)\b",
    re.I,
)
TARGET = 50

QUERIES = {
    "Mobile Apps": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "home screen with tab bar and content cards",
            "account overview with balance and recent activity",
            "product listing grid with search field",
            "music or podcast home with horizontal content rows",
            "map screen with nearby places and pins",
            "chat inbox with conversation list",
            "profile page with avatar stats and posts",
            "wallet home with cards and spending chart",
            "fitness dashboard with rings and workout summary",
            "food delivery home with restaurant cards",
        ],
    },
    "Product Design": {
        "tool": "search_screens",
        "platform": "web",
        "queries": [
            "product home with cards and left navigation",
            "project list table with filters and sidebar",
            "document editor with canvas and toolbar",
            "inbox with message list and reading pane",
            "kanban board with columns and cards",
            "settings page with sidebar navigation",
            "marketplace listing grid with search",
            "calendar week view with events",
            "crm companies list with table and filters",
            "ai assistant home with prompt input",
            "analytics dashboard with charts and kpi cards",
            "finance dashboard with revenue chart and balances",
            "admin dashboard with metrics table and filters",
            "user dashboard with activity graph",
        ],
    },
    "Website": {
        "tool": "search_sections",
        "queries": [
            "marketing homepage hero with product screenshot",
            "saas landing page hero with headline and call to action",
            "startup homepage hero with gradient and signup",
            "product marketing landing with feature screenshot",
            "website hero section with large headline",
            "brand landing page hero with logo",
            "campaign landing hero with product shot",
            "homepage hero with video and call to action",
        ],
    },
    "Onboarding": {
        "tool": "search_flows",
        "platforms": ["ios", "web"],
        "queries": [
            "onboarding with personalization steps",
            "welcome onboarding with value propositions",
            "first run setup with preferences",
            "account setup checklist onboarding",
            "product tour onboarding carousel",
        ],
    },
    "Navigation": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "home with bottom tab bar selected",
            "sidebar navigation menu with destinations",
            "top navigation bar with search and tabs",
            "hamburger menu overlay with links",
            "tab bar explore page with content grid",
            "floating tab bar home feed",
            "nested navigation list with chevrons",
            "app home with bottom navigation and header",
        ],
    },
    "Typography": {
        "tool": "search_sections",
        "queries": [
            "hero section with large headline and subcopy",
            "editorial landing hero with bold typography",
            "homepage hero with oversized wordmark",
            "about section with large serif headline",
            "feature section with big display type",
        ],
    },
    "Motion": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "stories with progress bars at the top",
            "full screen vertical video feed",
            "animated splash with brand illustration",
            "reels style video with overlay actions",
            "onboarding animation with illustration",
            "camera stories composer",
            "live video player with comments",
            "animated empty state illustration",
        ],
    },
    "Branding": {
        "tool": "search_sections",
        "queries": [
            "marketing homepage hero with logo and product shot",
            "brand landing page hero with call to action",
            "product marketing hero with screenshot",
            "startup homepage hero with gradient and headline",
            "saas landing hero with logo and signup",
        ],
    },
}

FILL_QUERIES = {
    "Website": {
        "tool": "search_sections",
        "queries": [
            "saas landing page hero with headline and call to action",
            "startup homepage hero with gradient and signup",
            "product marketing landing with feature screenshot",
            "campaign landing hero with product shot",
            "customer story landing hero",
            "webinar landing page hero",
            "open source project homepage hero",
        ],
    },
    "Typography": {
        "tool": "search_sections",
        "queries": [
            "editorial magazine homepage with serif headline",
            "portfolio homepage with oversized type",
            "fashion lookbook hero with display type",
            "architecture studio homepage typography",
            "book publisher landing with large type",
            "design agency about page with display type",
            "newspaper homepage masthead",
            "restaurant landing with custom type",
        ],
    },
    "Branding": {
        "tool": "search_sections",
        "queries": [
            "luxury brand homepage with logo",
            "fashion brand campaign landing",
            "food brand homepage with product photography",
            "sportswear brand campaign hero",
            "beverage brand landing with logo",
            "beauty brand homepage",
            "automotive brand landing",
            "consumer electronics brand hero",
        ],
    },
    "Navigation": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "explore tab with content grid and tab bar",
            "profile tab with bottom navigation",
            "settings list with chevrons and back bar",
            "search tab with recent queries",
            "menu drawer with user avatar",
        ],
    },
}

APPEND_QUERIES = {
    "Mobile Apps": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "popular social feed with stories and posts",
            "travel booking home with destination cards",
            "meditation home with daily session card",
            "photo gallery with albums and memories",
            "shopping bag with product recommendations",
            "health records with appointments list",
            "news reader with article cards",
            "ride history with map preview",
        ],
    },
    "Product Design": {
        "tool": "search_screens",
        "platform": "web",
        "queries": [
            "design tool canvas with layers panel",
            "code editor with file tree and tabs",
            "customer support inbox with tickets",
            "billing page with invoices table",
            "team workspace with project cards",
            "analytics report with filters",
            "knowledge base with article list",
            "video call dashboard with participants",
        ],
    },
    "Website": {
        "tool": "search_sections",
        "queries": [
            "product launch landing with countdown",
            "ai product homepage hero",
            "fintech homepage hero with app mockup",
            "developer tool landing with code snippet",
            "ecommerce homepage hero with product",
            "agency portfolio homepage",
            "health startup landing hero",
            "travel brand homepage hero",
        ],
    },
    "Onboarding": {
        "tool": "search_flows",
        "platforms": ["ios", "web"],
        "queries": [
            "choose interests onboarding",
            "goal setup onboarding",
            "permission intro onboarding",
            "profile photo onboarding",
            "welcome carousel onboarding",
        ],
    },
    "Navigation": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "library tab with collections grid",
            "notifications list with back button",
            "account tab with grouped settings",
            "shop tab with categories and tab bar",
            "inbox tab with filters",
        ],
    },
    "Typography": {
        "tool": "search_sections",
        "queries": [
            "studio homepage with kinetic type",
            "museum landing with display serif",
            "music festival landing typography",
            "architecture firm oversized headline",
            "wine brand editorial type",
            "gallery exhibition landing type",
        ],
    },
    "Motion": {
        "tool": "search_screens",
        "platform": "ios",
        "queries": [
            "story viewer with progress and stickers",
            "tiktok style for you feed",
            "audio player with waveform",
            "confetti success celebration",
            "pull to refresh animation screen",
            "interactive illustration home",
        ],
    },
    "Branding": {
        "tool": "search_sections",
        "queries": [
            "perfume brand campaign landing",
            "watch brand homepage",
            "outdoor brand campaign hero",
            "coffee brand landing",
            "skincare brand homepage",
            "sneaker drop landing",
        ],
    },
}


def token() -> str:
    if not TOKEN_PATH.exists():
        raise FileNotFoundError(str(TOKEN_PATH))
    with TOKEN_PATH.open() as f:
        return json.load(f)["access_token"]


def token_ttl() -> int:
    try:
        payload = token().split(".")[1]
        payload += "=" * (-len(payload) % 4)
        import base64

        data = json.loads(base64.urlsafe_b64decode(payload))
        return int(data.get("exp", 0) - time.time())
    except Exception:
        return 0


def refresh_token() -> str:
    global TOK
    client_path = TOKEN_PATH.with_name(
        TOKEN_PATH.name.replace("_tokens.json", "_client_info.json")
    )
    tokens = json.loads(TOKEN_PATH.read_text())
    client = json.loads(client_path.read_text())
    body = urlencode(
        {
            "grant_type": "refresh_token",
            "refresh_token": tokens["refresh_token"],
            "client_id": client["client_id"],
        }
    ).encode()
    req = urllib.request.Request(
        "https://ujasntkfphywizsdaapi.supabase.co/auth/v1/oauth/token",
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        fresh = json.loads(resp.read().decode())
    tokens.update(fresh)
    TOKEN_PATH.write_text(json.dumps(tokens, indent=2) + "\n")
    TOK = tokens["access_token"]
    return TOK


def ensure_token() -> str:
    global TOK
    if not TOKEN_PATH.exists():
        print("re-auth Mobbin MCP, then retry", flush=True)
        raise SystemExit(1)
    try:
        ttl = token_ttl()
    except Exception:
        print("re-auth Mobbin MCP, then retry", flush=True)
        raise SystemExit(1)
    if ttl > 600:
        TOK = token()
        print(f"token ok ({ttl}s left)", flush=True)
        return TOK
    print("refreshing mobbin token...", flush=True)
    try:
        return refresh_token()
    except Exception as exc:
        print("refresh failed:", exc, flush=True)
        print("re-auth Mobbin MCP, then retry", flush=True)
        raise SystemExit(1)


TOK = ""


def rpc(payload: dict, timeout: int = 90) -> dict:
    body = json.dumps(payload).encode()
    headers = {
        "Authorization": f"Bearer {TOK}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
        "Host": "api.mobbin.com",
        "Content-Length": str(len(body)),
    }
    conn = http.client.HTTPSConnection("api.mobbin.com", timeout=timeout)
    conn.request("POST", "/mcp", body=body, headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode("utf-8", "replace")
    conn.close()
    events = []
    for line in raw.splitlines():
        if line.startswith("data:"):
            chunk = line[5:].strip()
            if chunk and chunk != "[DONE]":
                try:
                    events.append(json.loads(chunk))
                except json.JSONDecodeError:
                    pass
    if events:
        return events[-1]
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"error": {"message": raw[:400]}}


def call_tool(name: str, arguments: dict) -> dict:
    res = rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
    )
    if "error" in res:
        print("  tool error", res["error"].get("message", res["error"])[:200])
        return {}
    for item in res.get("result", {}).get("content", []):
        if item.get("type") == "text":
            try:
                return json.loads(item["text"])
            except json.JSONDecodeError:
                return {}
    return {}


def explore_url(kind: str, item_id: str) -> str:
    return f"https://mobbin.com/explore/{kind}/{item_id}"


def fetch_html(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept": "text/html",
        },
    )
    with urllib.request.urlopen(req, timeout=18) as resp:
        return resp.read().decode("utf-8", "replace")


def cdn_from_html(html: str, prefer: str) -> str:
    og = re.search(
        r'property="og:image"[^>]*content="([^"]+)"', html
    ) or re.search(r'content="([^"]+)"[^>]*property="og:image"', html)
    if og:
        og_url = unescape(og.group(1))
        parsed = urlparse(og_url)
        screen = parse_qs(parsed.query).get("screenUrl", [""])[0]
        if screen:
            screen = unquote(screen)
            asset = re.search(r"content/(app_screens|sites)/([0-9a-f-]{36})", screen)
            if asset:
                kind, asset_id = asset.group(1), asset.group(2)
                return f"{CDN}/{kind}/{asset_id}.png?f=png&w=1200&q=70&fit=shrink-cover"
    kind = "sites" if prefer == "sites" else "app_screens"
    match = re.search(rf"content/{kind}/([0-9a-f-]{{36}})\.(?:png|webp|jpg)", html)
    if match:
        return f"{CDN}/{kind}/{match.group(1)}.png?f=png&w=1200&q=70&fit=shrink-cover"
    any_asset = re.search(
        r"content/(app_screens|sites)/([0-9a-f-]{36})\.(?:png|webp|jpg)", html
    )
    if any_asset:
        return f"{CDN}/{any_asset.group(1)}/{any_asset.group(2)}.png?f=png&w=1200&q=70&fit=shrink-cover"
    return ""


def resolve_image(url: str, prefer: str) -> str:
    try:
        return cdn_from_html(fetch_html(url), prefer)
    except Exception:
        return ""


def is_junk(text: str) -> bool:
    return bool(SKIP.search(text or ""))


def collect_screens(
    collection: str,
    spec: dict,
    limit: int = TARGET,
    skip_ids: set[str] | None = None,
) -> list[dict]:
    picked: list[dict] = []
    seen_ids: set[str] = set(skip_ids or [])
    seen_apps: set[str] = set()
    extras: list[dict] = []
    platform = spec["platform"]
    for query in spec["queries"]:
        if len(picked) >= limit:
            break
        exclude = list(seen_ids)[-100:]
        print(f"  screens {collection!r} / {query!r} (have {len(picked)})")
        data = call_tool(
            "search_screens",
            {
                "query": query,
                "platform": platform,
                "mode": "standard",
                "limit": 30,
                "image_format": "jpg",
                **({"exclude_screen_ids": exclude} if exclude else {}),
            },
        )
        for screen in data.get("screens") or []:
            sid = screen.get("id")
            app = (screen.get("app_name") or "").strip()
            if not sid or sid in seen_ids or not app:
                continue
            blob = f"{app} {screen.get('mobbin_url','')}"
            if is_junk(blob):
                continue
            seen_ids.add(sid)
            item = {
                "collection": collection,
                "title": app,
                "url": explore_url("screens", sid),
                "app": app.lower(),
                "prefer": "app_screens",
            }
            if app.lower() in seen_apps:
                extras.append(item)
            else:
                seen_apps.add(app.lower())
                picked.append(item)
            if len(picked) >= limit:
                break
    for item in extras:
        if len(picked) >= limit:
            break
        picked.append(item)
    return picked[:limit]


def collect_flows(
    collection: str,
    spec: dict,
    limit: int = TARGET,
    skip_ids: set[str] | None = None,
) -> list[dict]:
    picked: list[dict] = []
    seen_ids: set[str] = set(skip_ids or [])
    seen_apps: set[str] = set()
    extras: list[dict] = []
    for platform in spec["platforms"]:
        for query in spec["queries"]:
            for page in range(1, 21):
                if len(picked) >= limit:
                    break
                print(f"  flows {platform} p{page} {query!r} (have {len(picked)})")
                data = call_tool(
                    "search_flows",
                    {
                        "query": query,
                        "platform": platform,
                        "limit": 10,
                        "page": page,
                        "image_format": "jpg",
                    },
                )
                flows = data.get("flows") or []
                if not flows:
                    break
                for flow in flows:
                    fid = flow.get("id")
                    app = (flow.get("app_name") or "").strip()
                    name = flow.get("name") or ""
                    actions = " ".join(flow.get("actions") or [])
                    if not fid or fid in seen_ids or not app:
                        continue
                    if is_junk(f"{app} {name} {actions}"):
                        continue
                    if "onboard" not in f"{name} {actions}".lower() and page > 1:
                        continue
                    screens = flow.get("screens") or []
                    first = screens[0] if screens else {}
                    thumb_id = first.get("screen_id")
                    seen_ids.add(fid)
                    item = {
                        "collection": collection,
                        "title": app,
                        "url": explore_url("flows", fid),
                        "app": app.lower(),
                        "prefer": "app_screens",
                        "thumb_page": explore_url("screens", thumb_id) if thumb_id else explore_url("flows", fid),
                    }
                    if app.lower() in seen_apps:
                        extras.append(item)
                    else:
                        seen_apps.add(app.lower())
                        picked.append(item)
                if not data.get("has_next_page"):
                    break
            if len(picked) >= limit:
                break
        if len(picked) >= limit:
            break
    for item in extras:
        if len(picked) >= limit:
            break
        picked.append(item)
    return picked[:limit]


def collect_sections(
    collection: str,
    spec: dict,
    limit: int = TARGET,
    skip_ids: set[str] | None = None,
) -> list[dict]:
    picked: list[dict] = []
    seen_ids: set[str] = set(skip_ids or [])
    seen_apps: set[str] = set()
    extras: list[dict] = []
    for query in spec["queries"]:
        for page in range(1, 21):
            if len(picked) >= limit:
                break
            print(f"  sections p{page} {query!r} (have {len(picked)})")
            data = call_tool(
                "search_sections",
                {
                    "query": query,
                    "limit": 30,
                    "page": page,
                    "image_format": "jpg",
                },
            )
            sections = data.get("sections") or []
            if not sections:
                break
            for section in sections:
                sid = section.get("id")
                site = (section.get("site_name") or "").strip()
                if not sid or sid in seen_ids or not site:
                    continue
                if is_junk(site):
                    continue
                seen_ids.add(sid)
                item = {
                    "collection": collection,
                    "title": site,
                    "url": explore_url("sections", sid),
                    "app": site.lower(),
                    "prefer": "sites",
                }
                if site.lower() in seen_apps:
                    extras.append(item)
                else:
                    seen_apps.add(site.lower())
                    picked.append(item)
            if not data.get("has_next_page"):
                break
        if len(picked) >= limit:
            break
    for item in extras:
        if len(picked) >= limit:
            break
        picked.append(item)
    return picked[:limit]


def write_output(seeds: list[dict]) -> None:
    order = [
        "Mobile Apps",
        "Product Design",
        "Website",
        "Onboarding",
        "Navigation",
        "Motion",
    ]
    grouped: dict[str, list[dict]] = {name: [] for name in order}
    extra: list[dict] = []
    for item in seeds:
        if item["collection"] in grouped:
            grouped[item["collection"]].append(item)
        else:
            extra.append(item)
    seeds = [item for name in order for item in grouped[name]] + extra
    counts: dict[str, int] = {}
    for item in seeds:
        counts[item["collection"]] = counts.get(item["collection"], 0) + 1
    out = Path(__file__).resolve().parents[1] / "scripts/mobbin-seeds.json"
    out.write_text(json.dumps({"counts": counts, "seeds": seeds}, indent=2))
    print("wrote", out, "n=", len(seeds), counts)

    ts_path = Path(__file__).resolve().parents[1] / "src/lib/storage/seed-examples.ts"
    existing_ts = ts_path.read_text() if ts_path.exists() else ""
    retired = re.findall(
        r'"(https://[^"]+)"',
        existing_ts.split("export const EXAMPLE_SEEDS")[0] if "EXAMPLE_SEEDS" in existing_ts else "",
    )
    by_url = {}
    for match in re.finditer(
        r'\{ collection: "[^"]+", title: "[^"]+", url: "([^"]+)", imageUrl: "[^"]+"([^}]*)\}',
        existing_ts,
    ):
        extra = match.group(2)
        video = re.search(r'videoUrl: "([^"]*)"', extra)
        notes = re.search(r'notes: "((?:\\.|[^"\\])*)"', extra)
        source = re.search(r'source: "([^"]*)"', extra)
        by_url[match.group(1)] = {
            **({"videoUrl": video.group(1)} if video else {}),
            **({"notes": notes.group(1)} if notes else {}),
            **({"source": source.group(1)} if source else {}),
        }

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
    for item in seeds:
        if item["collection"] != current:
            if current is not None:
                lines.append("")
            current = item["collection"]
            lines.append(f"  // {current}")
        title = item["title"].replace("\\", "\\\\").replace('"', '\\"')
        tags = json.dumps(item.get("tags") or [])
        prior = by_url.get(item["url"], {})
        extra = ""
        video = item.get("videoUrl") or prior.get("videoUrl") or ""
        if video:
            extra += f', videoUrl: "{video}"'
        notes = (item.get("notes") or prior.get("notes") or "").replace("\\", "\\\\").replace('"', '\\"')
        if notes:
            extra += f', notes: "{notes}"'
        source = item.get("source") or prior.get("source") or ""
        if source:
            extra += f', source: "{source}"'
        lines.append(
            f'  {{ collection: "{item["collection"]}", title: "{title}", url: "{item["url"]}", imageUrl: "{item["imageUrl"]}", tags: {tags}{extra} }},'
        )
    lines.append("];")
    lines.append("")
    ts_path.write_text("\n".join(lines))
    print("wrote", ts_path, "n=", len(seeds))


def unique_seeds(seeds: list[dict]) -> list[dict]:
    seen_url: set[str] = set()
    seen_img: set[str] = set()
    kept: list[dict] = []
    for item in seeds:
        if item["url"] in seen_url or item["imageUrl"] in seen_img:
            continue
        seen_url.add(item["url"])
        seen_img.add(item["imageUrl"])
        kept.append(item)
    return kept


def load_existing_seeds() -> list[dict]:
    ts_path = Path(__file__).resolve().parents[1] / "src/lib/storage/seed-examples.ts"
    json_path = Path(__file__).resolve().parents[1] / "scripts/mobbin-seeds.json"
    items: list[dict] = []
    if ts_path.exists():
        text = ts_path.read_text()
        for match in re.finditer(
            r'\{ collection: "([^"]+)", title: "([^"]+)", url: "([^"]+)", imageUrl: "([^"]+)"([^}]*)\}',
            text,
        ):
            extra = match.group(5)
            video = re.search(r'videoUrl: "([^"]*)"', extra)
            notes = re.search(r'notes: "((?:\\.|[^"\\])*)"', extra)
            source = re.search(r'source: "([^"]*)"', extra)
            items.append(
                {
                    "collection": match.group(1),
                    "title": match.group(2),
                    "url": match.group(3),
                    "imageUrl": match.group(4),
                    "tags": [],
                    **({"videoUrl": video.group(1)} if video else {}),
                    **({"notes": notes.group(1)} if notes else {}),
                    **({"source": source.group(1)} if source else {}),
                }
            )
        if items:
            return unique_seeds(items)
    if json_path.exists():
        return unique_seeds(json.loads(json_path.read_text())["seeds"])
    return []


def merged_spec(collection: str) -> dict:
    sources = (APPEND_QUERIES, FILL_QUERIES, QUERIES)
    base: dict | None = None
    queries: list[str] = []
    seen: set[str] = set()
    for source in sources:
        spec = source.get(collection)
        if not spec:
            continue
        if base is None:
            base = {key: value for key, value in spec.items() if key != "queries"}
        for query in spec["queries"]:
            if query in seen:
                continue
            seen.add(query)
            queries.append(query)
    if base is None:
        raise KeyError(collection)
    return {**base, "queries": queries}


def append_more(n: int = TARGET) -> None:
    ensure_token()
    print("connecting to mobbin...", flush=True)
    rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "blake-list", "version": "1.0"},
            },
        }
    )
    seeds = load_existing_seeds()
    seen_urls = {item["url"] for item in seeds}
    seen_imgs = {item["imageUrl"] for item in seeds}
    seen_ids: set[str] = set()
    for url in seen_urls:
        match = re.search(r"/([0-9a-f-]{36})$", url)
        if match:
            seen_ids.add(match.group(1))

    order = [
        "Mobile Apps",
        "Product Design",
        "Website",
        "Onboarding",
        "Navigation",
    ]

    def count(name: str) -> int:
        return sum(1 for item in seeds if item["collection"] == name)

    for collection in order:
        spec = merged_spec(collection)
        print(f"\n== append {collection} +{n} (have {count(collection)}) ==")
        tool = spec["tool"]
        pool_limit = n * 5
        if tool == "search_screens":
            candidates = collect_screens(
                collection, spec, limit=pool_limit, skip_ids=seen_ids
            )
        elif tool == "search_flows":
            candidates = collect_flows(
                collection, spec, limit=pool_limit, skip_ids=seen_ids
            )
        else:
            candidates = collect_sections(
                collection, spec, limit=pool_limit, skip_ids=seen_ids
            )
        filtered = []
        for item in candidates:
            match = re.search(r"/([0-9a-f-]{36})$", item["url"])
            sid = match.group(1) if match else ""
            if item["url"] in seen_urls or sid in seen_ids:
                continue
            filtered.append(item)
        print(f"  resolving {len(filtered)} candidates")
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {
                pool.submit(
                    resolve_image, item.get("thumb_page") or item["url"], item["prefer"]
                ): item
                for item in filtered
            }
            for future in as_completed(futures):
                item = futures[future]
                item["imageUrl"] = future.result()

        existing_apps = {
            item["title"].lower()
            for item in seeds
            if item["collection"] == collection
        }
        preferred = []
        extras = []
        for item in filtered:
            image = item.get("imageUrl") or ""
            if not image or item["url"] in seen_urls or image in seen_imgs:
                continue
            hay = f"{item['url']} {image}"
            phone = "/app_screens/" in hay or "/flows/" in item["url"]
            if collection == "Mobile Apps" and "/app_screens/" not in hay:
                continue
            if collection == "Product Design" and (
                "/app_screens/" in hay or "/sections/" in item["url"]
            ):
                continue
            if collection == "Website" and phone:
                continue
            if collection == "Navigation" and "/app_screens/" not in hay:
                continue
            if item["title"].lower() in existing_apps:
                extras.append(item)
            else:
                preferred.append(item)

        added = 0
        for item in preferred + extras:
            if added >= n:
                break
            image = item["imageUrl"]
            if item["url"] in seen_urls or image in seen_imgs:
                continue
            seeds.append(
                {
                    "collection": collection,
                    "title": item["title"],
                    "url": item["url"],
                    "imageUrl": image,
                    "tags": [],
                }
            )
            seen_urls.add(item["url"])
            seen_imgs.add(image)
            existing_apps.add(item["title"].lower())
            match = re.search(r"/([0-9a-f-]{36})$", item["url"])
            if match:
                seen_ids.add(match.group(1))
            added += 1
        print(f"  added {added}, now {count(collection)}")

    write_output(seeds)


def fill_missing() -> None:
    ensure_token()
    rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "blake-list", "version": "1.0"},
            },
        }
    )
    path = Path(__file__).resolve().parents[1] / "scripts/mobbin-seeds.json"
    seeds = unique_seeds(json.loads(path.read_text())["seeds"])
    seen_urls = {item["url"] for item in seeds}
    seen_imgs = {item["imageUrl"] for item in seeds}
    seen_ids: set[str] = set()
    for url in seen_urls:
        match = re.search(r"/([0-9a-f-]{36})$", url)
        if match:
            seen_ids.add(match.group(1))

    def count(name: str) -> int:
        return sum(1 for item in seeds if item["collection"] == name)

    for collection, spec in FILL_QUERIES.items():
        need = TARGET - count(collection)
        if need <= 0:
            continue
        print(f"\n== fill {collection} need {need} ==")
        if spec["tool"] == "search_screens":
            candidates = collect_screens(collection, spec, limit=80)
        else:
            candidates = collect_sections(collection, spec, limit=80)
        filtered = []
        for item in candidates:
            match = re.search(r"/([0-9a-f-]{36})$", item["url"])
            sid = match.group(1) if match else ""
            if item["url"] in seen_urls or sid in seen_ids:
                continue
            filtered.append(item)
        print(f"  resolving {len(filtered)} candidates")
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {
                pool.submit(
                    resolve_image, item.get("thumb_page") or item["url"], item["prefer"]
                ): item
                for item in filtered
            }
            for future in as_completed(futures):
                item = futures[future]
                item["imageUrl"] = future.result()
        existing_apps = {
            item["title"].lower()
            for item in seeds
            if item["collection"] == collection
        }
        added = 0
        for item in filtered:
            if added >= need:
                break
            image = item.get("imageUrl") or ""
            if not image or item["url"] in seen_urls or image in seen_imgs:
                continue
            hay = f"{item['url']} {image}"
            phone = "/app_screens/" in hay or "/flows/" in item["url"]
            if collection == "Mobile Apps" and "/app_screens/" not in hay:
                continue
            if collection == "Product Design" and (
                "/app_screens/" in hay or "/sections/" in item["url"]
            ):
                continue
            if collection == "Website" and phone:
                continue
            if collection == "Navigation" and "/app_screens/" not in hay:
                continue
            if item["title"].lower() in existing_apps:
                continue
            seeds.append(
                {
                    "collection": collection,
                    "title": item["title"],
                    "url": item["url"],
                    "imageUrl": image,
                    "tags": [],
                }
            )
            seen_urls.add(item["url"])
            seen_imgs.add(image)
            existing_apps.add(item["title"].lower())
            match = re.search(r"/([0-9a-f-]{36})$", item["url"])
            if match:
                seen_ids.add(match.group(1))
            added += 1
        print(f"  added {added}, now {count(collection)}")

    write_output(seeds)


def main() -> None:
    ensure_token()
    rpc(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "blake-list", "version": "1.0"},
            },
        }
    )
    by_collection: dict[str, list[dict]] = {}
    for collection, spec in QUERIES.items():
        print(f"\n== {collection} ==")
        tool = spec["tool"]
        if tool == "search_screens":
            items = collect_screens(collection, spec)
        elif tool == "search_flows":
            items = collect_flows(collection, spec)
        else:
            items = collect_sections(collection, spec)
        by_collection[collection] = items
        print(f"  collected {len(items)}")

    to_resolve = []
    for items in by_collection.values():
        for item in items:
            to_resolve.append(item)

    print(f"\nResolving {len(to_resolve)} CDN images...")
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(resolve_image, item.get("thumb_page") or item["url"], item["prefer"]): item
            for item in to_resolve
        }
        for future in as_completed(futures):
            item = futures[future]
            item["imageUrl"] = future.result()

    seeds = []
    for collection, items in by_collection.items():
        kept = [item for item in items if item.get("imageUrl")]
        print(f"{collection}: {len(kept)} with images")
        for item in kept:
            seeds.append(
                {
                    "collection": collection,
                    "title": item["title"],
                    "url": item["url"],
                    "imageUrl": item["imageUrl"],
                    "tags": [],
                }
            )

    seeds = unique_seeds(seeds)
    write_output(seeds)


if __name__ == "__main__":
    if "--append" in sys.argv:
        append_more()
    elif "--fill" in sys.argv:
        fill_missing()
    else:
        main()
