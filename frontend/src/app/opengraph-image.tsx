import { ImageResponse } from "next/og";
export const runtime = "nodejs";
export const alt = "Tech Solutions — Your Partner in Digital Growth";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "#101828",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "90px",
        color: "white",
      }}
    >
      <div style={{ fontSize: 23, color: "#92baff", marginBottom: 45 }}>
        TECH SOLUTIONS
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 76,
          lineHeight: 1.05,
          letterSpacing: -3,
        }}
      >
        <span>Your partner in</span>
        <span>digital growth.</span>
      </div>
      <div style={{ fontSize: 25, marginTop: 40, color: "#a9bddb" }}>
        Strategy. Creativity. Technology.
      </div>
    </div>,
    size,
  );
}
