import type { SourceType } from "@/lib/storage/types";
import { hostnameOf } from "@/lib/utils";

const HOST_MAP: Array<[RegExp, SourceType]> = [
  [/^(x|twitter)\.com$/, "X"],
  [/^dribbble\.com$/, "Dribbble"],
  [/^behance\.net$/, "Behance"],
  [/^figma\.com$/, "Figma"],
  [/^mobbin\.com$/, "Mobbin"],
  [/^awwwards\.com$/, "Awwwards"],
  [/^pinterest\.(com|co\.\w+)$/, "Pinterest"],
];

export function detectSource(url: string): SourceType {
  const host = hostnameOf(url);
  for (const [pattern, source] of HOST_MAP) {
    if (pattern.test(host)) return source;
  }
  return "Website";
}
