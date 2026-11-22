// Share card for WhatsApp/iMessage previews of a brand page.
import { ImageResponse } from "next/og";
import { brandBySlug } from "@/lib/summary";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MedMatch: Indian medicine in the USA";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const b = brandBySlug((await params).slug);
  const name = b?.brand ?? "Your medicine";
  const ings = b ? b.salts.map((s) => `${s.name} ${s.mg} mg`).join(" + ") : "";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0d9488,#065f46)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>+</div>
          {"MedMatch"}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, opacity: 0.85 }}>From India</div>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.05 }}>{`${name} in the USA`}</div>
          {ings && <div style={{ fontSize: 36, marginTop: 16, opacity: 0.9 }}>{ings}</div>}
        </div>
        <div style={{ fontSize: 30, opacity: 0.85 }}>US name · prescription or not · what to ask the pharmacist</div>
      </div>
    ),
    size,
  );
}
