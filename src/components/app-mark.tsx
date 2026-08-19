"use client";

import { useId } from "react";

const SPARKLE =
  "M12 1C12.38 7.55 16.45 11.62 23 12C16.45 12.38 12.38 16.45 12 23C11.62 16.45 7.55 12.38 1 12C7.55 11.62 11.62 7.55 12 1Z";

export function AppMark({ size = 32 }: { size?: number }) {
  const raw = useId();
  const gid = `mark-${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="48%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="7" fill="#000" />
      <path
        transform="translate(4 4)"
        d={SPARKLE}
        fill="none"
        stroke={`url(#${gid})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
