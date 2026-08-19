#!/usr/bin/env python3
"""Append inspiration / patterns / dembrandt / better-design seeds. Additive only."""

from __future__ import annotations

import importlib.util
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRAPE = Path(__file__).resolve().parent / "scrape-mobbin-seeds.py"
R2 = "https://pub-2e4ecbcbc9b24e7b93f1a6ab5b2bc71f.r2.dev/designs/{slug}/preview-screenshot.png"


def load_writer():
    spec = importlib.util.spec_from_file_location("mobbin_scrape", SCRAPE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.write_output, module.unique_seeds, module.load_existing_seeds


def mshot(url: str) -> str:
    return f"https://s.wordpress.com/mshots/v1/{urllib.parse.quote(url, safe='')}?w=1600"


def r2(slug: str) -> str:
    return R2.format(slug=slug)


def norm(url: str) -> str:
    parsed = urllib.parse.urlparse(url.strip().rstrip("/").lower())
    host = parsed.netloc[4:] if parsed.netloc.startswith("www.") else parsed.netloc
    return f"{parsed.scheme}://{host}{parsed.path}"


def seed(collection, title, url, tags, notes, source, image=None):
    return {
        "collection": collection,
        "title": title,
        "url": url,
        "imageUrl": image or mshot(url),
        "tags": tags,
        "notes": notes,
        "source": source,
    }


# --- 50 from design-inspiration-mcp (curated scrapers + design-md) ---
INSPIRATION = [
    seed("Mobile Apps", "Phantom", "https://phantom.app", ["crypto", "dark", "mobile", "wallet"], "Solana wallet marketing: purple-black glow, floating UI mockups, product as the hero.", "Website"),
    seed("Mobile Apps", "Wise", "https://wise.com", ["fintech", "green", "mobile", "transfer"], "Cross-border money app. Bright green CTAs, plain-spoken type, calculator-first home.", "Website", r2("wise")),
    seed("Mobile Apps", "Revolut", "https://www.revolut.com", ["fintech", "dark", "cards", "mobile"], "Virtual card hero, dense action row, merchant-logo transactions. Fintech as a consumer brand.", "Website", r2("revolut")),
    seed("Mobile Apps", "Pinterest", "https://www.pinterest.com", ["masonry", "visual", "discovery"], "Masonry discovery grid. The feed is the product; chrome stays out of the way.", "Website", r2("pinterest")),
    seed("Mobile Apps", "Tesla", "https://www.tesla.com", ["product", "cinematic", "hardware"], "Hardware site that behaves like an app: full-bleed cars, sparse type, configurator energy.", "Website", r2("tesla")),
    seed("Mobile Apps", "Coinbase", "https://www.coinbase.com", ["crypto", "blue", "fintech"], "Retail crypto home. Blue system, product shots of the mobile app, trust-first marketing.", "Website", r2("coinbase")),
    seed("Mobile Apps", "Kraken", "https://www.kraken.com", ["crypto", "purple", "trading"], "Exchange marketing with purple accent and dense market modules.", "Website", r2("kraken")),
    seed("Product Design", "Linear", "https://linear.app", ["dark-mode", "saas", "minimal", "indigo"], "Near-black canvas, Inter 510, indigo #5e6ad2. Issue tracking as a precision instrument.", "Awwwards", r2("linear.app")),
    seed("Product Design", "Notion", "https://www.notion.so", ["minimal", "editor", "saas"], "The copied SaaS pattern: product screenshot as hero, warm greys, free-tier CTA.", "Website", r2("notion")),
    seed("Product Design", "Figma", "https://www.figma.com", ["colorful", "collaboration", "design-tool"], "Multiplayer cursors in the hero. Color does the explaining.", "Website", r2("figma")),
    seed("Product Design", "Airtable", "https://www.airtable.com", ["colorful", "spreadsheet", "saas"], "Database-as-spreadsheet sold with bright product UI and friendly illustration.", "Website", r2("airtable")),
    seed("Product Design", "Miro", "https://miro.com", ["canvas", "collaboration", "yellow"], "Infinite canvas marketing. Yellow accent, workshop energy, product is the illustration.", "Website", r2("miro")),
    seed("Product Design", "PostHog", "https://posthog.com", ["developer", "open-source", "product-analytics"], "Open-source analytics. Hog mascot, dense product UI, docs-adjacent marketing.", "Website", r2("posthog")),
    seed("Product Design", "ClickHouse", "https://clickhouse.com", ["developer", "data", "yellow"], "Columnar database brand: yellow-on-dark, query-first, engineering-trusting layout.", "Website", r2("clickhouse")),
    seed("Marketing", "Pitch", "https://pitch.com", ["colorful", "gradient", "saas"], "Section-based color shifts (coral, teal, purple). Presentation tool with theatrical marketing.", "Awwwards"),
    seed("Marketing", "Loom", "https://www.loom.com", ["video", "dark", "gradient"], "Dark hero with autoplay product demo. The value prop is shown, not described.", "Website"),
    seed("Marketing", "Covalent", "https://www.covalenthq.com", ["dark", "data", "gradient"], "Blockchain data API. Animated network graph as hero; data is the design.", "Website"),
    seed("Marketing", "Craft CMS", "https://craftcms.com", ["light", "cms", "teal"], "Off-white professional SaaS. Clear hierarchy, one focal CTA per page.", "Website"),
    seed("Marketing", "Lovable", "https://lovable.dev", ["ai", "builder", "gradient"], "AI app builder marketing. Playful product shots, fast-start CTA.", "Website", r2("lovable")),
    seed("Marketing", "Framer", "https://www.framer.com", ["pink", "interactive", "builder"], "Hot pink on white, live component demos, Neue Montreal energy.", "Awwwards", r2("framer")),
    seed("Onboarding", "Supabase", "https://supabase.com", ["developer", "auth", "green"], "Auth and backend onboarding sold with green-on-dark docs energy and a start-in-minutes CTA.", "Website", r2("supabase")),
    seed("Onboarding", "Clay", "https://www.clay.com", ["gtm", "colorful", "saas"], "GTM workspace. Playful onboarding story, spreadsheet-plus-enrichment as the hook.", "Website", r2("clay")),
    seed("Onboarding", "Intercom", "https://www.intercom.com", ["support", "messenger", "saas"], "Customer onboarding and messenger. Friendly illustration, product UI as the proof.", "Website", r2("intercom")),
    seed("Onboarding", "Warp", "https://www.warp.dev", ["developer", "terminal", "dark"], "Terminal that onboards with blocks and AI. Dark, keyboard-first, setup in one screen.", "Website", r2("warp")),
    seed("Onboarding", "Headspace", "https://www.headspace.com", ["wellness", "illustration", "orange"], "Warm coral, rounded everything, illustrated first-run. Calm as a visual system.", "Website"),
    seed("Onboarding", "Duolingo", "https://www.duolingo.com", ["playful", "gamification", "green"], "Hearts, streaks, one action per screen. Onboarding as a game loop.", "Website"),
    seed("Navigation", "Cuberto", "https://cuberto.com", ["agency", "cursor", "motion"], "Magnetic cursor, clip-masked project hovers. Agency nav as a performance.", "Awwwards"),
    seed("Navigation", "Obys Agency", "https://obys.agency", ["horizontal-scroll", "typography", "agency"], "Horizontal scroll, oversized type as the map. Navigation by viewport-width headlines.", "Awwwards"),
    seed("Navigation", "Garden Eight", "https://garden-eight.com", ["editorial", "japanese", "minimal"], "Ink-spread type, bilingual layout, calm menus. Restraint as wayfinding.", "Awwwards"),
    seed("Navigation", "Basement Studio", "https://basement.studio", ["experimental", "scanline", "dark"], "CRT scanlines, scroll-reactive type. The nav feels like a terminal overlay.", "Awwwards"),
    seed("Navigation", "SiteInspire", "https://www.siteinspire.com", ["gallery", "minimal", "grid"], "Ultra-clean gallery chrome. Filters and masonry, the UI disappears.", "Website"),
    seed("Navigation", "Aristide Benoist", "https://www.aristidebenoist.com", ["webgl", "portfolio", "dark"], "Fullscreen WebGL nav. Hover distorts the whole viewport.", "Awwwards"),
    seed("Typography", "Monotype", "https://www.monotype.com", ["editorial", "serif", "foundry"], "Type foundry as editorial powerhouse. Display serifs, ink-printed color.", "Website"),
    seed("Typography", "Claude", "https://claude.ai", ["editorial", "ai", "serif"], "Research-lab calm. Warm paper field, measured type, lots of air.", "Website", r2("claude")),
    seed("Typography", "xAI", "https://x.ai", ["editorial", "dark", "ai"], "Grok marketing. Tight grotesque, black field, sparse statements.", "Website", r2("x.ai")),
    seed("Typography", "Mistral AI", "https://mistral.ai", ["editorial", "ai", "french"], "European lab typesetting. Quiet headlines, technical body, restrained color.", "Website", r2("mistral.ai")),
    seed("Typography", "Ollama", "https://ollama.com", ["developer", "monospace", "local-ai"], "Local models. Terminal-adjacent type, almost no marketing chrome.", "Website", r2("ollama")),
    seed("Typography", "Together AI", "https://www.together.ai", ["developer", "ai", "infra"], "Inference cloud. Technical labels, Berkeley-mono energy, dense but readable.", "Website", r2("together.ai")),
    seed("Motion", "Paco Coursey", "https://paco.me", ["page-transition", "minimal", "dark"], "Shared-layout route transitions. Card-flip continuity between pages.", "Website"),
    seed("Motion", "animations.dev", "https://animations.dev", ["spring", "micro-interaction", "education"], "Spring-physics UI gallery. Drawers, sheets, tooltips that overshoot and settle.", "Website"),
    seed("Motion", "Three.js Journey", "https://threejs-journey.com", ["webgl", "particles", "3d"], "Particle galaxy hero. The course is sold through its medium.", "Website"),
    seed("Motion", "Codrops", "https://tympanus.net/codrops", ["css", "experimental", "education"], "Clip-path, @property, view transitions. The catalog of creative CSS motion.", "Website"),
    seed("Motion", "iPhone 15 Pro", "https://www.apple.com/iphone-15-pro/", ["scroll-story", "video-scrub", "product"], "Scroll-synced video. One feature per scroll unit. The motion benchmark.", "Awwwards"),
    seed("Motion", "Stripe Annual Letter", "https://stripe.com/annual-updates/2023", ["data-viz", "editorial", "svg"], "Charts draw on scroll. Numbers count up. Editorial motion, not decoration.", "Awwwards"),
    seed("Branding", "Ferrari", "https://www.ferrari.com", ["luxury", "red", "automotive"], "Rosso as a system. Cinematic product films, sculpted type, heritage grid.", "Website", r2("ferrari")),
    seed("Branding", "Lamborghini", "https://www.lamborghini.com", ["luxury", "angular", "automotive"], "Sharp geometry, yellow-green accents, aggressive cropping.", "Website", r2("lamborghini")),
    seed("Branding", "BMW", "https://www.bmw.com", ["automotive", "premium", "kinetic"], "Kinetic wordmark, precise photography, germanic spacing.", "Website", r2("bmw")),
    seed("Branding", "SpaceX", "https://www.spacex.com", ["aerospace", "minimal", "black"], "Black field, live launches, type as mission control.", "Website", r2("spacex")),
    seed("Branding", "NVIDIA", "https://www.nvidia.com", ["green", "tech", "gpu"], "NVIDIA green, product renders, developer-to-consumer split.", "Website", r2("nvidia")),
    seed("Branding", "Renault", "https://www.renault.com", ["automotive", "electric", "european"], "EV-era identity. Softer geometry, campaign photography, yellow diamond.", "Website", r2("renault")),
]

# --- 100 from design_patterns_mcp intent: real UI pattern galleries / docs ---
PATTERNS = [
    seed("Mobile Apps", "Mobile Patterns", "https://www.mobile-patterns.com", ["mobile", "patterns", "ios"], "Screenshot library of iOS/Android patterns. Browse by screen type.", "Website"),
    seed("Mobile Apps", "Pttrns", "https://pttrns.com", ["mobile", "ios", "patterns"], "Classic iOS pattern archive. Tabs, onboarding, lists, nav.", "Website"),
    seed("Mobile Apps", "Screenlane", "https://www.screenlane.com", ["mobile", "web", "patterns"], "UI flows tagged by pattern. Strong on mobile apps and SaaS.", "Website"),
    seed("Mobile Apps", "Page Flows", "https://pageflows.com", ["flows", "mobile", "saas"], "Full user flows, not isolated screens. Checkout, signup, settings.", "Website"),
    seed("Mobile Apps", "Refero", "https://refero.design", ["web-app", "patterns", "search"], "Searchable web-app screens. Product UI as a reference library.", "Website"),
    seed("Mobile Apps", "UI Sources", "https://www.uisources.com", ["mobile", "screenshots"], "App screenshot archive organised by category and vendor.", "Website"),
    seed("Mobile Apps", "iOS Design", "https://www.ios.design", ["ios", "hig", "components"], "iOS component gallery mapped to Apple HIG language.", "Website"),
    seed("Mobile Apps", "HIG getting started", "https://developer.apple.com/design/human-interface-guidelines/getting-started", ["ios", "hig", "design-system"], "Apple Human Interface Guidelines. Semantic platform tokens, not raw hex.", "Website"),
    seed("Mobile Apps", "Material 3 components", "https://m3.material.io/components", ["android", "material", "components"], "M3 component catalog with color roles, states, and motion.", "Website"),
    seed("Mobile Apps", "Ionic components", "https://ionicframework.com/docs", ["mobile", "components", "hybrid"], "Cross-platform mobile components with adaptive iOS/MD modes.", "Website"),
    seed("Mobile Apps", "React Native components", "https://reactnative.dev/docs/components-and-apis", ["react-native", "mobile", "primitives"], "Core RN primitives. The building blocks behind most app UIs.", "Website"),
    seed("Mobile Apps", "Expo router UI", "https://docs.expo.dev/router/introduction/", ["expo", "navigation", "mobile"], "File-based mobile navigation. Tabs and stacks as a system.", "Website"),
    seed("Mobile Apps", "Capacitor UI", "https://capacitorjs.com", ["hybrid", "mobile", "webview"], "Native shell around web UI. Pattern for wrapping product web in apps.", "Website"),
    seed("Product Design", "UI Patterns", "https://ui-patterns.com", ["patterns", "ux", "catalog"], "Named interaction patterns with examples and when-to-use notes.", "Website"),
    seed("Product Design", "UX Patterns", "https://www.uxpatterns.dev", ["patterns", "product", "web"], "Modern product UX patterns with implementation notes.", "Website"),
    seed("Product Design", "Component Gallery", "https://component.gallery", ["components", "design-system", "survey"], "How real design systems name and structure the same components.", "Website"),
    seed("Product Design", "Design Systems", "https://www.designsystems.com", ["design-system", "tokens", "docs"], "Interviews and system docs. How teams operationalize tokens.", "Website"),
    seed("Product Design", "PatternFly", "https://www.patternfly.org", ["enterprise", "redhat", "components"], "Red Hat enterprise system. Dense admin patterns, accessibility first.", "Website"),
    seed("Product Design", "Carbon components", "https://carbondesignsystem.com/components/overview", ["ibm", "design-system", "tokens"], "IBM Carbon component overview. Semantic tokens, not hex in product UI.", "Website"),
    seed("Product Design", "Polaris components", "https://polaris.shopify.com/components", ["shopify", "commerce", "components"], "Shopify admin components. Merchant density done carefully.", "Website"),
    seed("Product Design", "Atlassian components", "https://atlassian.design/components", ["atlassian", "dense", "product"], "Jira/Confluence density. Nested navigation, flags, lozenges.", "Website"),
    seed("Product Design", "Spectrum components", "https://spectrum.adobe.com/page/components", ["adobe", "spectrum", "tokens"], "Adobe Spectrum. Platform-adaptive components and color roles.", "Website"),
    seed("Product Design", "Fluent 2 components", "https://fluent2.microsoft.design/components", ["microsoft", "fluent", "winui"], "Fluent 2. Rest, hover, pressed, disabled as a tokenized state machine.", "Website"),
    seed("Product Design", "Lightning components", "https://www.lightningdesignsystem.com/components/overview", ["salesforce", "enterprise", "forms"], "Salesforce Lightning. Form-heavy CRM patterns at scale.", "Website"),
    seed("Product Design", "Primer product", "https://primer.style/product", ["github", "primer", "developer"], "GitHub Primer product UI. Developer-tool density, calm greys.", "Website"),
    seed("Product Design", "Ant Design overview", "https://ant.design/components/overview", ["antd", "enterprise", "tables"], "Ant Design. Tables, filters, and admin scaffolds as a complete system.", "Website"),
    seed("Marketing", "Landingfolio", "https://landingfolio.com", ["landing", "saas", "gallery"], "SaaS landing gallery. Heroes, logos, pricing as repeating patterns.", "Website"),
    seed("Marketing", "SaaSframe", "https://www.saasframe.io", ["saas", "landing", "sections"], "Landing sections broken into hero, social proof, feature, FAQ.", "Website"),
    seed("Marketing", "Land-book", "https://land-book.com", ["landing", "gallery", "inspiration"], "Landing-page gallery used by the inspiration MCP LandBook scraper.", "Website"),
    seed("Marketing", "Awwwards web design", "https://www.awwwards.com/websites/web-design/", ["awwwards", "gallery", "sotd"], "Site of the Day archive. Motion, type, and craft as the filter.", "Awwwards"),
    seed("Marketing", "CSS Design Awards", "https://www.cssdesignawards.com", ["cssda", "gallery", "awards"], "CSSDA winners. Technique-forward marketing sites.", "Website"),
    seed("Marketing", "Godly", "https://godly.website", ["motion", "gallery", "dark"], "Hand-picked dark, motion-heavy sites. The Godly scraper source.", "Website"),
    seed("Marketing", "One Page Love", "https://onepagelove.com", ["one-page", "landing", "gallery"], "Single-page marketing. Narrative scroll as the pattern.", "Website"),
    seed("Marketing", "Httpster", "https://httpster.net", ["gallery", "experimental", "web"], "Curated weird and excellent. Good for non-SaaS marketing craft.", "Website"),
    seed("Marketing", "Best Website Gallery", "https://www.bestwebsite.gallery", ["gallery", "minimal", "editorial"], "Quiet editorial gallery. Type and photography over gimmicks.", "Website"),
    seed("Marketing", "Behance UI/UX", "https://www.behance.net/galleries/ui-ux", ["behance", "case-study", "ui"], "Behance UI/UX gallery. Case-study marketing of product work.", "Behance"),
    seed("Marketing", "Dribbble Popular", "https://dribbble.com/shots/popular", ["dribbble", "shots", "popular"], "Popular shots index. High-like product and marketing UI.", "Dribbble"),
    seed("Marketing", "SiteInspire websites", "https://www.siteinspire.com/websites", ["gallery", "filter", "web"], "Style-filtered site index. The SiteInspire MCP browse target.", "Website"),
    seed("Onboarding", "NN/g login walls", "https://www.nngroup.com/articles/login-walls/", ["onboarding", "auth", "research"], "Why login walls kill first-run. Research pattern, not a vibe.", "Website"),
    seed("Onboarding", "NN/g progressive disclosure", "https://www.nngroup.com/articles/progressive-disclosure/", ["onboarding", "complexity", "ux"], "Show only what is needed now. The core onboarding pattern.", "Website"),
    seed("Onboarding", "Baymard onboarding", "https://baymard.com/blog/checkout-usability", ["checkout", "forms", "research"], "Checkout and first-run form research. Reduce fields, keep progress.", "Website"),
    seed("Onboarding", "GoodUI", "https://www.goodui.org", ["experiments", "patterns", "conversion"], "A/B-tested UI ideas. Evidence-backed onboarding and CTA patterns.", "Website"),
    seed("Onboarding", "Laws of UX", "https://lawsofux.com", ["heuristics", "cognitive", "patterns"], "Hick, Fitts, Peak-End. Cognitive laws as onboarding constraints.", "Website"),
    seed("Onboarding", "Appcues", "https://www.appcues.com", ["product-tours", "checklists", "saas"], "Product tours and checklists as a system, not a modal pile-on.", "Website"),
    seed("Onboarding", "Userpilot", "https://www.userpilot.com", ["in-app", "tours", "activation"], "In-app activation. Tooltips, checklists, secondary CTA patterns.", "Website"),
    seed("Onboarding", "Pendo", "https://www.pendo.io", ["guides", "analytics", "adoption"], "Guides plus analytics. Onboarding as a measured funnel.", "Website"),
    seed("Onboarding", "Chameleon", "https://www.chameleon.io", ["tours", "no-code", "adoption"], "No-code tours. Pattern library of tooltips, hotspots, launchers.", "Website"),
    seed("Onboarding", "Product Fruits", "https://www.productfruits.com", ["tours", "hints", "saas"], "Hints and checklists for B2B first-run without engineering.", "Website"),
    seed("Onboarding", "Whatfix", "https://www.whatfix.com", ["dap", "enterprise", "training"], "Digital adoption. Enterprise onboarding over dense admin UIs.", "Website"),
    seed("Onboarding", "WalkMe", "https://www.walkme.com", ["dap", "enterprise", "flows"], "Flow-based enterprise onboarding over legacy product chrome.", "Website"),
    seed("Onboarding", "Heap", "https://www.heap.io", ["analytics", "activation", "funnels"], "Autocapture funnels. How teams see where onboarding drops.", "Website"),
    seed("Navigation", "NN/g mega menus", "https://www.nngroup.com/articles/mega-menus-work/", ["mega-menu", "ia", "research"], "When mega menus work. Wide IA without burying destinations.", "Website"),
    seed("Navigation", "NN/g breadcrumbs", "https://www.nngroup.com/articles/breadcrumbs/", ["breadcrumbs", "wayfinding"], "Location breadcrumbs. Hierarchy made visible.", "Website"),
    seed("Navigation", "APG menubar", "https://www.w3.org/WAI/ARIA/apg/patterns/menubar/", ["aria", "menu", "a11y"], "Accessible menubar pattern. Keyboard model, roles, focus.", "Website"),
    seed("Navigation", "APG tabs", "https://www.w3.org/WAI/ARIA/apg/patterns/tabs/", ["tabs", "aria", "a11y"], "Tabs pattern with automatic vs manual activation.", "Website"),
    seed("Navigation", "APG disclosure", "https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/", ["disclosure", "nav", "a11y"], "Show/hide navigation sections without breaking accessibility.", "Website"),
    seed("Navigation", "Inclusive menus", "https://inclusive-components.design/menus-menu-buttons/", ["inclusive", "menu", "button"], "Menu buttons vs navigation. Inclusive Components canonical.", "Website"),
    seed("Navigation", "Inclusive tabs", "https://inclusive-components.design/tabbed-interfaces/", ["tabs", "inclusive", "a11y"], "Tabbed interfaces that do not trap keyboard users.", "Website"),
    seed("Navigation", "Radix navigation menu", "https://www.radix-ui.com/primitives/docs/components/navigation-menu", ["radix", "headless", "nav"], "Headless nav menu. Composition over restyled <select>.", "Website"),
    seed("Navigation", "shadcn navigation menu", "https://ui.shadcn.com/docs/components/navigation-menu", ["shadcn", "tokens", "nav"], "Tokenized Radix nav. Semantic colors, not raw hex.", "Website"),
    seed("Navigation", "M3 navigation bar", "https://m3.material.io/components/navigation-bar/overview", ["android", "tab-bar", "material"], "Bottom nav bar. 3–5 destinations, badge, active indicator.", "Website"),
    seed("Navigation", "HIG tab bars", "https://developer.apple.com/design/human-interface-guidelines/tab-bars", ["ios", "tab-bar", "hig"], "iOS tab bars. Top-level app structure, SF Symbols, selection.", "Website"),
    seed("Navigation", "Carbon UI shell", "https://carbondesignsystem.com/components/ui-shell/usage", ["ibm", "sidebar", "shell"], "Left nav + header shell. Enterprise information architecture.", "Website"),
    seed("Typography", "Google Fonts", "https://fonts.google.com", ["type", "catalog", "pairings"], "The public type catalog. Pairings, axes, and specimen pages.", "Website"),
    seed("Typography", "Typotheque", "https://www.typetheque.com", ["foundry", "editorial", "specimen"], "Specimens as layout. Type is the page, not a decoration.", "Website"),
    seed("Typography", "Klim Type Foundry", "https://klim.co.nz", ["foundry", "editorial", "new-zealand"], "Klim specimens. Tight editorial grid, confident display sizes.", "Website"),
    seed("Typography", "Commercial Type", "https://www.commercialtype.com", ["foundry", "news", "grotesque"], "News grotesques and magazine serifs. Specimens with real text.", "Website"),
    seed("Typography", "Grilli Type", "https://www.grillitype.com", ["foundry", "swiss", "specimen"], "Swiss-ish catalog. Huge type, tiny meta, almost no chrome.", "Website"),
    seed("Typography", "Ohno Type", "https://www.ohnotype.co", ["foundry", "display", "playful"], "Display faces with a wink. Specimens that feel like posters.", "Website"),
    seed("Typography", "Dinamo", "https://abcdinamo.com", ["foundry", "variable", "trial"], "Variable fonts, trials, and a site that is a typesetting demo.", "Website"),
    seed("Typography", "Future Fonts", "https://www.futurefonts.xyz", ["in-progress", "foundry", "indie"], "In-progress type. Buy early, watch the design system of a face evolve.", "Website"),
    seed("Typography", "Fontstand", "https://fontstand.com", ["rental", "foundry", "catalog"], "Rent-to-own type. Catalog UI that treats fonts as products.", "Website"),
    seed("Typography", "Fontshop", "https://www.fontshop.com", ["catalog", "monotype", "specimens"], "Large retail catalog. Filters, related faces, in-use samples.", "Website"),
    seed("Typography", "Pangram Pangram", "https://pangrampangram.com", ["foundry", "display", "montreal"], "Montreal foundry. Loud specimens, tight tracking, fashion-adjacent.", "Website"),
    seed("Typography", "Sharp Type", "https://www.sharptype.co", ["foundry", "editorial", "news"], "News and editorial faces. Specimens set like magazines.", "Website"),
    seed("Motion", "GSAP", "https://gsap.com", ["gsap", "scrolltrigger", "motion"], "The industry timeline. ScrollTrigger, scrub, pin — documented with demos.", "Website"),
    seed("Motion", "Rive", "https://rive.app", ["rive", "state-machine", "motion"], "Interactive motion as a file format. State machines, not GIFs.", "Website"),
    seed("Motion", "LottieFiles", "https://lottiefiles.com", ["lottie", "after-effects", "micro"], "Lottie marketplace. Micro-interactions as JSON, not video.", "Website"),
    seed("Motion", "Animate.css", "https://animate.style", ["css", "utility", "keyframes"], "Named CSS keyframes. A vocabulary for entrance and attention.", "Website"),
    seed("Motion", "AutoAnimate", "https://auto-animate.formkit.com", ["layout", "auto-animate", "dom"], "Zero-config layout animation when the DOM changes.", "Website"),
    seed("Motion", "Sonner", "https://sonner.emilkowal.ski", ["toast", "spring", "micro"], "Toast stack with spring physics. Opinionated motion tokens.", "Website"),
    seed("Motion", "Vaul", "https://vaul.emilkowal.ski", ["drawer", "sheet", "gesture"], "Mobile drawer. Drag to dismiss, snap points, iOS physics.", "Website"),
    seed("Motion", "Hover.dev", "https://www.hover.dev", ["react", "tailwind", "micro"], "Copy-paste hover and motion snippets. Pattern-level, not full sites.", "Website"),
    seed("Motion", "Theatre.js", "https://www.theatrejs.com", ["timeline", "webgl", "studio"], "Motion design studio in the browser. Sequences for 3D and DOM.", "Website"),
    seed("Motion", "Lenis", "https://lenis.darkroom.engineering", ["smooth-scroll", "lenis", "lerp"], "Smooth scroll as a primitive. Lerp, not scroll-jacking.", "Website"),
    seed("Motion", "Easings", "https://easings.net", ["easing", "curves", "tokens"], "Named cubic-beziers. The motion-token cheatsheet.", "Website"),
    seed("Motion", "Cubic Bezier", "https://cubic-bezier.com", ["easing", "tool", "curve"], "Interactive bezier editor. Design the token, then name it.", "Website"),
    seed("Branding", "Brand New", "https://www.underconsideration.com/brandnew/", ["identity", "critique", "rebrand"], "Rebrand critique. Before/after systems, not just logos.", "Website"),
    seed("Branding", "BP&O", "https://bpando.org", ["packaging", "identity", "editorial"], "Packaging and identity reviews. Physical systems photographed well.", "Website"),
    seed("Branding", "The Brand Identity", "https://thebrandidentity.com", ["identity", "studio", "case-study"], "Studio case studies. Type, color, applications in one narrative.", "Website"),
    seed("Branding", "LogoLounge", "https://www.logolounge.com", ["logo", "trends", "archive"], "Logo archive and trend reports. Marks in context.", "Website"),
    seed("Branding", "Rebrand", "https://www.rebrand.com", ["awards", "identity", "systems"], "Rebrand awards. Full identity systems, not isolated wordmarks.", "Website"),
    seed("Branding", "Branding Style Guides", "https://brandingstyleguides.com", ["guidelines", "pdf", "systems"], "Public brand guidelines. How real teams document the system.", "Website"),
    seed("Branding", "Wolff Olins", "https://www.wolffolins.com", ["agency", "identity", "transform"], "Identity as transformation. Large-scale brand programs.", "Website"),
    seed("Branding", "Landor", "https://www.landor.com", ["agency", "identity", "global"], "Global brand consultancy. Systems that survive translation.", "Website"),
    seed("Branding", "Collins", "https://www.wearecollins.com", ["studio", "identity", "cultural"], "Cultural identity work. Brands that behave like publishers.", "Website"),
    seed("Branding", "Order", "https://order.design", ["studio", "identity", "tech"], "Tech identity. Tight type, one accent, applications that scale.", "Website"),
    seed("Branding", "Pentagram work", "https://www.pentagram.com/work", ["studio", "archive", "identity"], "Work archive. Identities in a relentless grid.", "Website"),
    seed("Branding", "Dribbble branding", "https://dribbble.com/shots/popular/branding", ["dribbble", "identity", "popular"], "Popular branding shots. Systems, guidelines, and marks.", "Dribbble"),
    seed("Branding", "Behance graphic design", "https://www.behance.net/galleries/graphic-design", ["behance", "identity", "print"], "Graphic design gallery. Identity applied to print and digital.", "Behance"),
]

# --- 50 dembrandt-style live sites (token notes, source Website) ---
DEMBRANDT = [
    seed("Mobile Apps", "Cash App", "https://cash.app", ["green", "#00D632", "fintech", "mobile"], "Token extract: Cash Green #00D632 on near-black, heavy rounded sans, tight app-store CTAs.", "Website"),
    seed("Mobile Apps", "Chime", "https://www.chime.com", ["green", "fintech", "consumer"], "Token extract: mint/teal brand, large product phone shots, friendly sans, lots of air.", "Website"),
    seed("Mobile Apps", "Venmo", "https://venmo.com", ["blue", "#008CFF", "social-payments"], "Token extract: Venmo blue #008CFF, social feed as the product, bubble UI language.", "Website"),
    seed("Mobile Apps", "Klarna", "https://www.klarna.com", ["pink", "fintech", "checkout"], "Token extract: Klarna pink field, black grotesque, checkout-as-brand.", "Website"),
    seed("Mobile Apps", "Nubank", "https://nubank.com.br", ["purple", "fintech", "latam"], "Token extract: Nubank purple, white type, card photography, mobile-first spacing.", "Website"),
    seed("Mobile Apps", "Robinhood", "https://robinhood.com", ["green", "#00C805", "trading"], "Token extract: Robinhood green #00C805, dark trading surfaces, numeric type emphasis.", "Website"),
    seed("Product Design", "GitHub", "https://github.com", ["primer", "developer", "neutral"], "Token extract: Primer greys, success green, canvas #0d1117 in dark, 8px spacing.", "Website"),
    seed("Product Design", "GitLab", "https://gitlab.com", ["orange", "#FC6D26", "devops"], "Token extract: Tanuki orange #FC6D26, dense product nav, purple-adjacent dark theme.", "Website"),
    seed("Product Design", "PlanetScale", "https://planetscale.com", ["developer", "dark", "database"], "Token extract: near-black, electric accents, monospace for schema, wide marketing grid.", "Website"),
    seed("Product Design", "Render", "https://render.com", ["developer", "deploy", "blue"], "Token extract: clean light surfaces, blue deploy accents, dashboard screenshots as proof.", "Website"),
    seed("Product Design", "Fly.io", "https://fly.io", ["developer", "purple", "edge"], "Token extract: eggplant/purple brand, technical diagrams, docs-like marketing type.", "Website"),
    seed("Product Design", "Netlify", "https://www.netlify.com", ["teal", "deploy", "composable"], "Token extract: Netlify teal, light canvas, function/edge diagrams, rounded cards.", "Website"),
    seed("Product Design", "Replit", "https://replit.com", ["orange", "ide", "education"], "Token extract: Replit orange, IDE chrome in the hero, dense but playful type.", "Website"),
    seed("Marketing", "Datadog", "https://www.datadoghq.com", ["purple", "observability", "saas"], "Token extract: Datadog purple, dog mascot, screenshot-heavy enterprise landing.", "Website"),
    seed("Marketing", "Cloudflare", "https://www.cloudflare.com", ["orange", "#F38020", "infra"], "Token extract: Cloudflare orange #F38020, diagrammatic heroes, trust-badge strips.", "Website"),
    seed("Marketing", "DigitalOcean", "https://www.digitalocean.com", ["blue", "cloud", "simple"], "Token extract: DO blue, friendly illustration, pricing tables as a design element.", "Website"),
    seed("Marketing", "Netflix", "https://www.netflix.com", ["red", "#E50914", "entertainment"], "Token extract: Netflix red #E50914 on black, huge display, cinematic stills.", "Website"),
    seed("Marketing", "Zapier", "https://zapier.com", ["orange", "automation", "saas"], "Token extract: Zapier orange, diagram connectors, playful product UI in the hero.", "Website", r2("zapier")),
    seed("Marketing", "Sentry", "https://sentry.io", ["pink", "error", "developer"], "Token extract: Sentry pink/purple, dark developer marketing, code as the product shot.", "Website", r2("sentry")),
    seed("Onboarding", "Todoist", "https://www.todoist.com", ["red", "productivity", "checklist"], "Token extract: Todoist red, karma gamification, checklist-first onboarding.", "Website"),
    seed("Onboarding", "Calm", "https://www.calm.com", ["blue", "wellness", "night"], "Token extract: deep blue night scenes, serif headlines, restful spacing.", "Website"),
    seed("Onboarding", "Strava", "https://www.strava.com", ["orange", "#FC4C02", "fitness"], "Token extract: Strava orange #FC4C02, activity maps, kudos as social proof.", "Website"),
    seed("Onboarding", "Grammarly", "https://www.grammarly.com", ["green", "writing", "assistant"], "Token extract: Grammarly green, product GIF in hero, underline-as-brand.", "Website"),
    seed("Onboarding", "Canva", "https://www.canva.com", ["teal", "creator", "templates"], "Token extract: Canva teal/purple, template grid, onboarding by making something.", "Website"),
    seed("Onboarding", "Skillshare", "https://www.skillshare.com", ["green", "education", "classes"], "Token extract: Skillshare green, class cards, first-run as a catalog browse.", "Website"),
    seed("Navigation", "Discord", "https://discord.com", ["blurple", "#5865F2", "chat"], "Token extract: Discord Blurple #5865F2, dark #313338 app chrome, server rail nav.", "Website"),
    seed("Navigation", "Telegram", "https://telegram.org", ["blue", "chat", "minimal"], "Token extract: Telegram blue, paper-plane mark, simple marketing nav + app screenshots.", "Website"),
    seed("Navigation", "WhatsApp", "https://www.whatsapp.com", ["green", "#25D366", "chat"], "Token extract: WhatsApp green #25D366, teal dark mode, chat-list information architecture.", "Website"),
    seed("Navigation", "Signal", "https://signal.org", ["blue", "privacy", "chat"], "Token extract: Signal blue, privacy-first sparse marketing, simple top nav.", "Website"),
    seed("Navigation", "Hacker News", "https://news.ycombinator.com", ["orange", "#FF6600", "brutalist"], "Token extract: HN orange #FF6600, 85% Verdana, almost no spacing tokens — density as brand.", "Website"),
    seed("Navigation", "Product Hunt", "https://www.producthunt.com", ["orange", "#DA552F", "catalog"], "Token extract: PH orange, upvote orange, catalog nav with daily ranking.", "Website"),
    seed("Typography", "HashiCorp", "https://www.hashicorp.com", ["black", "enterprise", "mono"], "Token extract: HashiCorp black, system grotesque + mono for code, dense but aligned type.", "Website", r2("hashicorp")),
    seed("Typography", "Inter", "https://rsms.me/inter", ["variable", "ui-sans", "specimen"], "Token extract: Inter variable specimen. Optical size, cv01/ss03, the default product sans.", "Website"),
    seed("Typography", "Adobe Fonts", "https://fonts.adobe.com", ["catalog", "typekit", "specimens"], "Token extract: Adobe Fonts. Cream/black editorial, large specimens, filter chrome.", "Website"),
    seed("Typography", "Hoefler&Co", "https://www.typography.com", ["foundry", "editorial", "premium"], "Token extract: H&Co. High-contrast serifs, catalog as a magazine, tight tracking.", "Website"),
    seed("Typography", "DJRtype", "https://djr.com", ["foundry", "display", "specimen"], "Token extract: DJR. Loud display specimens, color used as ink, not UI chrome.", "Website"),
    seed("Typography", "Lineto", "https://lineto.com", ["foundry", "grotesk", "swiss"], "Token extract: Lineto. Industrial grotesks, almost architectural spacing.", "Website"),
    seed("Typography", "Swiss Typefaces", "https://www.swisstypefaces.com", ["foundry", "swiss", "specimen"], "Token extract: Swiss Typefaces. Maxi specimens, tiny UI, type as the only color.", "Website"),
    seed("Motion", "Apple iPhone", "https://www.apple.com/iphone/", ["product", "scroll", "cinematic"], "Token extract: Apple black/white, SF Pro, scroll-scrubbed product films, huge type steps.", "Website"),
    seed("Motion", "Resn", "https://resn.co.nz", ["experimental", "webgl", "agency"], "Token extract: Resn. Dark canvas, experimental type, motion as the brand voice.", "Website"),
    seed("Motion", "UNIT9", "https://www.unit9.com", ["agency", "cinematic", "interactive"], "Token extract: UNIT9. Full-bleed case films, condensed type, hover-driven index.", "Website"),
    seed("Motion", "Media.Monks", "https://media.monks.com", ["agency", "network", "motion"], "Token extract: Media.Monks. Network-scale case grid, kinetic type, dark/light swings.", "Website"),
    seed("Motion", "Active Theory work", "https://activetheory.net/work", ["webgl", "case-study", "interaction"], "Token extract: work index of WebGL pieces. Black, white, one accent, gesture-driven.", "Website"),
    seed("Motion", "Lusion work", "https://lusion.co/works", ["webgl", "3d", "studio"], "Token extract: Lusion case index. Dark, mouse-reactive, type as sculpture.", "Website"),
    seed("Branding", "Patagonia", "https://www.patagonia.com", ["outdoor", "activist", "catalog"], "Token extract: Fitz Roy palette, utilitarian sans, photography over chrome.", "Website"),
    seed("Branding", "MUJI", "https://www.muji.com", ["minimal", "no-brand", "beige"], "Token extract: unbleached beige, red mark, emptiness as the identity.", "Website"),
    seed("Branding", "Uniqlo", "https://www.uniqlo.com", ["red", "retail", "grid"], "Token extract: Uniqlo red, LifeWear grid, product photography on white.", "Website"),
    seed("Branding", "COS", "https://www.cos.com", ["editorial", "fashion", "minimal"], "Token extract: COS. Architectural stills, sparse type, near-monochrome.", "Website"),
    seed("Branding", "Arket", "https://www.arket.com", ["nordic", "editorial", "retail"], "Token extract: Arket. Newsprint type, product as objects, quiet color.", "Website"),
    seed("Branding", "HAY", "https://hay.com", ["colorful", "furniture", "danish"], "Token extract: HAY. Saturated object photography, playful geometric type.", "Website"),
]

# --- 50 better-design / resolve-design-system docs & token galleries ---
BETTER = [
    seed("Mobile Apps", "Apple Design", "https://developer.apple.com/design", ["hig", "sf-symbols", "tokens"], "HIG hub. Semantic materials, SF Symbols, platform components instead of raw color.", "Website"),
    seed("Mobile Apps", "Material Design 3", "https://m3.material.io", ["material", "roles", "dynamic-color"], "Color roles (primary, surface, outline). Dynamic color, not a hex styleguide.", "Website"),
    seed("Mobile Apps", "Heroicons", "https://heroicons.com", ["icons", "svg", "tokens"], "Icon library matched to Tailwind. Optical 24/20 sizes, stroke as a token.", "Website"),
    seed("Mobile Apps", "Ionicons", "https://ionic.io/ionicons", ["icons", "mobile", "adaptive"], "Adaptive iOS/Material icons. Resolve icons with the same names as components.", "Website"),
    seed("Mobile Apps", "SF Symbols", "https://developer.apple.com/sf-symbols/", ["sf-symbols", "ios", "iconography"], "Variable icons with weights. The iOS icon system, not a third-party pack.", "Website"),
    seed("Mobile Apps", "Phosphor Icons", "https://phosphoricons.com", ["icons", "duotone", "weights"], "6-weight icon system. Duotone as a second color token.", "Website"),
    seed("Product Design", "Radix UI", "https://www.radix-ui.com", ["radix", "headless", "a11y"], "Unstyled accessible primitives. Pair with semantic tokens, not baked colors.", "Website"),
    seed("Product Design", "shadcn/ui", "https://ui.shadcn.com", ["shadcn", "tokens", "components"], "Copy-paste components on Radix + CSS variables. The better-design default stack.", "Website"),
    seed("Product Design", "Untitled UI", "https://www.untitledui.com", ["figma", "saas", "kit"], "SaaS Figma kit. Tokens, components, and pages already mapped.", "Website"),
    seed("Product Design", "Base UI", "https://base-ui.com", ["mui", "headless", "primitives"], "MUI headless primitives. Behavior without visual lock-in.", "Website"),
    seed("Product Design", "Ark UI", "https://ark-ui.com", ["zag", "headless", "multi-framework"], "Zag-powered headless components. Framework-agnostic state machines.", "Website"),
    seed("Product Design", "Park UI", "https://park-ui.com", ["panda", "ark", "tokens"], "Ark + Panda CSS. Recipe-based semantic tokens.", "Website"),
    seed("Product Design", "Chakra UI", "https://chakra-ui.com", ["chakra", "tokens", "theme"], "Theme object as the design system. Semantic tokens in JS.", "Website"),
    seed("Marketing", "Vercel", "https://vercel.com", ["black", "developer", "grid"], "Black marketing canvas, framework logos, deploy as the story. Token-tight type.", "Website", r2("vercel")),
    seed("Marketing", "Stripe", "https://stripe.com", ["gradient", "indigo", "fintech"], "Indigo #635BFF, mesh gradients, code as a marketing component.", "Website", r2("stripe")),
    seed("Marketing", "Resend", "https://resend.com", ["dark", "developer", "green"], "Dark #08090A, ivory type, neon code. Email API with a design-system landing.", "Website", r2("resend")),
    seed("Marketing", "21st.dev", "https://21st.dev", ["components", "registry", "shadcn"], "Component registry. Resolve-design-system style: pick a kit, get tokens + code.", "Website"),
    seed("Marketing", "Aceternity UI", "https://ui.aceternity.com", ["tailwind", "motion", "marketing"], "Marketing-grade effects on Tailwind tokens. Heroes, bento, spotlights.", "Website"),
    seed("Marketing", "Magic UI", "https://magicui.design", ["shadcn", "motion", "landing"], "Animated landing components. Semantic tokens plus motion recipes.", "Website"),
    seed("Onboarding", "Clerk components", "https://clerk.com/docs/components/overview", ["auth", "components", "onboarding"], "Prebuilt sign-in/up. Auth onboarding as a component API, not a custom form.", "Website"),
    seed("Onboarding", "WorkOS", "https://workos.com", ["enterprise-auth", "sso", "onboarding"], "SSO and directory sync. Enterprise onboarding as infrastructure UI.", "Website"),
    seed("Onboarding", "Auth0", "https://auth0.com", ["auth", "universal-login", "onboarding"], "Universal Login. Hosted onboarding with brand tokens you inject.", "Website"),
    seed("Onboarding", "Stripe Checkout", "https://stripe.com/payments/checkout", ["checkout", "fintech", "forms"], "Hosted checkout. Payment onboarding with Stripe’s semantic form system.", "Website"),
    seed("Onboarding", "Linear Method", "https://linear.app/method", ["product", "process", "docs"], "How Linear teams work. Product onboarding as a written system.", "Website"),
    seed("Onboarding", "Vercel templates", "https://vercel.com/templates", ["templates", "start", "next"], "Start from a tokenized template instead of a blank canvas.", "Website"),
    seed("Navigation", "Radix Themes", "https://www.radix-ui.com/themes", ["themes", "tokens", "layout"], "Opinionated Radix layout + color scales. Sidebar and nav included.", "Website"),
    seed("Navigation", "shadcn sidebar", "https://ui.shadcn.com/docs/components/sidebar", ["sidebar", "shadcn", "app-shell"], "App shell sidebar. Collapsible, tokenized, dashboard IA.", "Website"),
    seed("Navigation", "Mantine", "https://mantine.dev", ["mantine", "hooks", "components"], "Full component set including AppShell, NavLink, tabs.", "Website"),
    seed("Navigation", "MUI", "https://mui.com", ["material", "appbar", "drawer"], "AppBar + Drawer. The canonical React dashboard shell.", "Website"),
    seed("Navigation", "Ant Design", "https://ant.design", ["antd", "layout", "sider"], "Sider + Header layout. Enterprise nav as a default scaffold.", "Website"),
    seed("Navigation", "Primer", "https://primer.style", ["github", "primer", "css"], "GitHub’s system. CSS utilities + product nav patterns.", "Website"),
    seed("Typography", "Open Props", "https://open-props.style", ["tokens", "css", "type"], "CSS custom properties for type, color, shadows. Tokens without a framework.", "Website"),
    seed("Typography", "Utopia", "https://utopia.fyi", ["fluid-type", "modular-scale", "tokens"], "Fluid type and space scales. Clamp() as the typography system.", "Website"),
    seed("Typography", "Every Layout", "https://every-layout.dev", ["layout", "composition", "css"], "Composable layout primitives. Stack, cluster, sidebar — not grid hacks.", "Website"),
    seed("Typography", "Inclusive Components", "https://inclusive-components.design", ["a11y", "patterns", "type"], "Accessible component essays. Type and focus as first-class tokens.", "Website"),
    seed("Typography", "Tailwind CSS", "https://tailwindcss.com", ["utility", "scale", "type"], "Type scale, leading, tracking as utilities. The default token vocabulary.", "Website"),
    seed("Typography", "IBM Carbon", "https://carbondesignsystem.com", ["ibm", "type-scale", "tokens"], "Carbon type scale, productive vs expressive, spacing tokens.", "Website"),
    seed("Motion", "Framer Motion docs", "https://www.framer.com/motion/", ["motion", "layoutid", "spring"], "LayoutId, springs, gestures. Motion as a component API.", "Website"),
    seed("Motion", "Origin UI", "https://originui.com", ["components", "motion", "tailwind"], "Animated component set. Marketing and app motion on tokens.", "Website"),
    seed("Motion", "DaisyUI", "https://daisyui.com", ["themes", "components", "semantic"], "Semantic theme classes (primary, accent). Swap palettes, keep structure.", "Website"),
    seed("Motion", "HeroUI", "https://www.heroui.com", ["nextui", "tokens", "react"], "HeroUI (NextUI). Themeable React kit with motion-ready components.", "Website"),
    seed("Motion", "Flowbite", "https://flowbite.com", ["tailwind", "components", "gallery"], "Tailwind component gallery. Interactive examples with tokenized themes.", "Website"),
    seed("Motion", "Tailwind UI", "https://tailwindui.com", ["official", "kits", "marketing"], "Official kits. Marketing and app shells already on the Tailwind scale.", "Website"),
    seed("Branding", "Shopify Polaris", "https://polaris.shopify.com", ["commerce", "tokens", "admin"], "Merchant-facing system. Color, type, and content guidelines together.", "Website"),
    seed("Branding", "Atlassian Design", "https://atlassian.design", ["atlassian", "brand", "product"], "Brand + product in one. Illustrations, logos, and dense UI tokens.", "Website"),
    seed("Branding", "Adobe Spectrum", "https://spectrum.adobe.com", ["adobe", "spectrum", "platform"], "Cross-platform Adobe brand. Platform tokens, not one hex per control.", "Website"),
    seed("Branding", "Fluent 2", "https://fluent2.microsoft.design", ["microsoft", "fluent", "brand"], "Fluent 2 brand and product. Elevation, rest states, acrylic materials.", "Website"),
    seed("Branding", "Lightning Design System", "https://www.lightningdesignsystem.com", ["salesforce", "brand", "enterprise"], "Salesforce brand in product. Lightning tokens for CRM density.", "Website"),
    seed("Branding", "Polar", "https://polar.sh", ["open-source", "payments", "dark"], "Open-source monetization UI. Dark product, Stripe-adjacent token taste.", "Website"),
    seed("Branding", "Tokens Studio", "https://www.tokens.studio", ["tokens", "figma", "w3c"], "W3C-style design tokens in Figma. The resolve-design-system data layer.", "Website"),
    seed("Branding", "Style Dictionary", "https://amzn.github.io/style-dictionary/#/", ["tokens", "build", "multi-platform"], "Amazon Style Dictionary. Tokens compiled to iOS, Android, CSS.", "Website"),
]


def take(candidates, n, seen_urls, seen_imgs):
    kept = []
    for item in candidates:
        key = norm(item["url"])
        img = item["imageUrl"]
        if key in seen_urls or img in seen_imgs:
            continue
        seen_urls.add(key)
        seen_imgs.add(img)
        kept.append(item)
        if len(kept) >= n:
            break
    return kept


def counts(seeds):
    out = {}
    for item in seeds:
        out[item["collection"]] = out.get(item["collection"], 0) + 1
    return out


def main() -> None:
    write_output, unique_seeds, load_existing_seeds = load_writer()
    existing = unique_seeds(load_existing_seeds())
    before_n = len(existing)
    before = counts(existing)
    seen_urls = {norm(item["url"]) for item in existing}
    seen_imgs = {item["imageUrl"] for item in existing}

    a = take(INSPIRATION, 50, seen_urls, seen_imgs)
    b = take(PATTERNS, 100, seen_urls, seen_imgs)
    c = take(DEMBRANDT, 50, seen_urls, seen_imgs)
    d = take(BETTER, 50, seen_urls, seen_imgs)
    print(f"inspiration {len(a)}/50  patterns {len(b)}/100  dembrandt {len(c)}/50  better-design {len(d)}/50")
    if len(a) != 50 or len(b) != 100 or len(c) != 50 or len(d) != 50:
        raise SystemExit("did not land exact batch sizes")

    merged = existing + a + b + c + d
    if len(unique_seeds(merged)) != len(merged):
        raise SystemExit("duplicate url or image after merge")
    oura = any("0ffe05f5-fc89-47f9-8856-ce81d86e817a" in item["url"] for item in merged)
    if not oura:
        raise SystemExit("Oura seed missing")

    write_output(merged)
    after = counts(merged)
    print("before", before_n, before)
    print("after", len(merged), after)
    print("added", len(merged) - before_n)
    print("oura", oura)


if __name__ == "__main__":
    main()
