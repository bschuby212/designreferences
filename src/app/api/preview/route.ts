import { generateLinkPreview } from "@/lib/preview/generateLinkPreview";
import { normalizeUrl } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = normalizeUrl(body.url ?? "");
    if (!url) {
      return Response.json({ error: "A valid URL is required." }, { status: 400 });
    }
    const preview = await generateLinkPreview(url);
    return Response.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Preview failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
