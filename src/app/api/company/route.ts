import { productName } from "@/lib/utils";

export const runtime = "nodejs";

const cache = new Map<string, { extract: string; expires: number }>();
const TTL_MS = 1000 * 60 * 60 * 24;

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
    const encoded = encodeURIComponent(company.replace(/\.$/, ""));
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      {
        headers: {
          "Api-User-Agent": "design-reference-library/0.1 (local library)",
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      cache.set(company.toLowerCase(), { extract: "", expires: Date.now() + TTL_MS });
      return Response.json({ name: company, extract: "" });
    }
    const data = (await response.json()) as {
      type?: string;
      extract?: string;
    };
    const extract =
      data.type === "standard" || data.type === "disambiguation"
        ? data.type === "standard"
          ? sentences(data.extract ?? "", 2)
          : ""
        : sentences(data.extract ?? "", 2);
    cache.set(company.toLowerCase(), {
      extract,
      expires: Date.now() + TTL_MS,
    });
    return Response.json({ name: company, extract });
  } catch {
    return Response.json({ name: company, extract: "" });
  }
}

function sentences(text: string, count: number) {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!parts) return text.trim();
  return parts.slice(0, count).join(" ").trim();
}
