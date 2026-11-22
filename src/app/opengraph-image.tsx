import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MedMatch: find your Indian medicine at a US pharmacy";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0d9488,#065f46)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>+</div>
          MedMatch
        </div>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.05 }}>Brought medicine from India?</div>
        <div style={{ fontSize: 34, opacity: 0.9 }}>Find its US name, whether you need a prescription, and what to ask the pharmacist.</div>
      </div>
    ),
    size,
  );
}
