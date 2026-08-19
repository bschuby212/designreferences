import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          borderRadius: 40,
        }}
      >
        <svg width="135" height="135" viewBox="0 0 24 24">
          <defs>
            <linearGradient id="spark" x1="1" y1="1" x2="23" y2="23">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="48%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#f472b6" />
            </linearGradient>
          </defs>
          <path
            d="M12 1C12.38 7.55 16.45 11.62 23 12C16.45 12.38 12.38 16.45 12 23C11.62 16.45 7.55 12.38 1 12C7.55 11.62 11.62 7.55 12 1Z"
            fill="none"
            stroke="url(#spark)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
