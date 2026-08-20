export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid() {
  return crypto.randomUUID();
}

export function now() {
  return Date.now();
}

export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol).toString();
  } catch {
    return "";
  }
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Display-only product name. Stored titles stay unchanged for search. */
export function productName(title: string) {
  const cleaned = title
    .replace(/\s+(iOS|Android|Web)\b[\s\S]*$/i, "")
    .replace(/\s+section$/i, "")
    .trim();
  return cleaned || title.trim() || "Untitled";
}

export function formatSavedDate(ts: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(ts));
}

export function base64ToBlob(data: string, mime: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime || "image/jpeg" });
}

export function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
