import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#14b8a6,#047857)", borderRadius: 112 }}>
        <div style={{ position: "absolute", width: 72, height: 300, background: "white", borderRadius: 36 }} />
        <div style={{ position: "absolute", width: 300, height: 72, background: "white", borderRadius: 36 }} />
      </div>
    ),
    size,
  );
}
