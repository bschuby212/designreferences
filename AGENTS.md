<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Stack: Next.js 16 (Turbopack) + React 19 + Tailwind v4. Single client-side app; all reference data is stored in the browser via IndexedDB (Dexie), so there is no database/service to run and no auth.
- Run/lint commands live in `package.json`: `npm run dev` (dev server on port 3000), `npm run lint`, `npm run build`. There are no automated tests in this repo.
- The only server-side code is the `POST /api/preview` route, which fetches a URL's Open Graph metadata (via `cheerio`) to build link previews. It makes outbound HTTP requests to arbitrary URLs, so preview generation for a link requires network egress to that host.
- Hello-world flow to sanity-check the app: click "+" (top-right) → "Add Link" → paste a URL → a preview thumbnail/title auto-populates → Save → the card appears in the gallery.
