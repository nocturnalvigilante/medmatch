import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#14b8a6,#047857)", borderRadius: 0 }}>
        <div style={{ position: "absolute", width: 26, height: 106, background: "white", borderRadius: 13 }} />
        <div style={{ position: "absolute", width: 106, height: 26, background: "white", borderRadius: 13 }} />
      </div>
    ),
    size,
  );
}
