/** Direct looping previews for motion sites (not a still of the marketing page). */

export const MOTION_PREVIEW_BY_URL: Record<string, string> = {
  "https://lenis.darkroom.engineering":
    "https://darkroom-lenis-showcase.s3.us-east-1.amazonaws.com/pbc_1930884531/cypda2odb92k89b/netflix_webm_zzv7giof3n.webm",
  "https://lenis.darkroom.engineering/":
    "https://darkroom-lenis-showcase.s3.us-east-1.amazonaws.com/pbc_1930884531/cypda2odb92k89b/netflix_webm_zzv7giof3n.webm",
  "https://media.monks.com":
    "https://www.monks.com/data/2025-06/Monks-Sizzle_1280x720.mp4?VersionId=e_Tm.MWDsvT7_TH5rRxdV8GpsPlsTS1q",
  "https://media.monks.com/":
    "https://www.monks.com/data/2025-06/Monks-Sizzle_1280x720.mp4?VersionId=e_Tm.MWDsvT7_TH5rRxdV8GpsPlsTS1q",
};

export function motionPreviewFor(url: string, fallback?: string | null) {
  const trimmed = url.replace(/\/$/, "");
  return (
    MOTION_PREVIEW_BY_URL[url] ||
    MOTION_PREVIEW_BY_URL[trimmed] ||
    MOTION_PREVIEW_BY_URL[`${trimmed}/`] ||
    fallback ||
    null
  );
}
