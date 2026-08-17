import type { SourceType, ThumbnailType } from "@/lib/storage/types";

export interface LinkPreview {
  title: string;
  url: string;
  siteName: string;
  favicon: string;
  source: SourceType;
  thumbnail: { mime: string; data: string } | null;
  thumbnailType: ThumbnailType;
}
