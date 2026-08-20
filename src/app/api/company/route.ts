import { productName } from "@/lib/utils";

export const runtime = "nodejs";

const cache = new Map<string, { extract: string; expires: number }>();
const TTL_MS = 1000 * 60 * 60 * 24;
const HEADERS = {
  "User-Agent":
    "design-reference-library/0.1 (https://github.com/bschuby212/designreferences)",
  Accept: "application/json",
};
const KINDS = [
  "company",
  "software",
  "app",
  "application",
  "website",
  "service",
  "productivity software",
];

export async function GET(request: Request) {
  const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
  const company = productName(name) || name;
  if (!company) {
    return Response.json({ name: "", extract: "" });
  }

  const cached = cache.get(company.toLowerCase());
  if (cached && cached.expires > Date.now()) {
    return Response.json({ name: company, extract: cached.extract });
  }

  try {
    const extract = await lookup(company);
    if (extract) {
      cache.set(company.toLowerCase(), {
        extract,
        expires: Date.now() + TTL_MS,
      });
    }
    return Response.json({ name: company, extract });
  } catch {
    return Response.json({ name: company, extract: "" });
  }
}

async function lookup(company: string) {
  const preferred = await summary(`${company} (company)`, company);
  if (preferred) return preferred;
  const rest = await Promise.all(
    [
      ...KINDS.filter((kind) => kind !== "company").map(
        (kind) => `${company} (${kind})`,
      ),
      company,
    ].map((title) => summary(title, company)),
  );
  return rest.find(Boolean) ?? "";
}

async function summary(title: string, company: string) {
  const encoded = encodeURIComponent(title.replace(/\s+/g, "_").replace(/\.$/, ""));
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
    { headers: HEADERS },
  );
  if (!response.ok) return "";
  const data = (await response.json()) as {
    type?: string;
    title?: string;
    extract?: string;
  };
  if (data.type !== "standard" || !data.extract) return "";
  if (!acceptable(company, data.title ?? title)) return "";
  return sentences(data.extract, 2);
}

function acceptable(company: string, title: string) {
  const name = company.toLowerCase();
  const page = title.toLowerCase();
  if (page === name || page.startsWith(`${name}, inc`)) return true;
  const match = page.match(/^(.*) \((.+)\)$/);
  return Boolean(match && match[1] === name && KINDS.includes(match[2]));
}

function sentences(text: string, count: number) {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts) return text.trim();
  return parts.slice(0, count).join(" ").trim();
}
