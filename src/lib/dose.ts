// Strengths: Indian strips print mg, mcg (thyroid, vitamin B12, inhalers) or g. Internally every strength is in mg
// (RxNorm writes levothyroxine 50 mcg as "0.05 MG"), and the label printed on the strip is kept for display.
// User test (Thyronorm 50 mcg): the strength box only took mg, and the AI summary said "50 mg isn't sold in the US".

const UNIT: Record<string, number> = { mg: 1, mcg: 0.001, "µg": 0.001, ug: 0.001, g: 1000, gm: 1000 };

/** "50mcg" → 0.05, "650" → 650, "1 g" → 1000. Per-ml strengths ("100mg/5ml") and other units → undefined. */
export function parseDose(text: string | undefined): number | undefined {
  const m = String(text ?? "").trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|gm|g)?$/);
  if (!m) return undefined;
  const v = Number(m[1]) * UNIT[m[2] ?? "mg"];
  return v > 0 ? Number(v.toPrecision(6)) : undefined;
}

/** "50mcg" → "50 mcg"; anything parseDose can't read → undefined. */
export function doseLabel(text: string | undefined): string | undefined {
  const m = String(text ?? "").trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|gm|g)?$/);
  if (!m) return undefined;
  const unit = m[2] === "µg" || m[2] === "ug" ? "mcg" : m[2] === "gm" ? "g" : (m[2] ?? "mg");
  return `${m[1]} ${unit}`;
}

/** What to show for a strength: the strip's own label if we have it, else mg. */
export function showDose(mg: number | undefined, label?: string): string {
  if (label) return label;
  if (!mg) return "";
  return mg < 1 ? `${Number((mg * 1000).toPrecision(6))} mcg` : `${mg} mg`;
}

/** RxNorm product names write strengths as "0.05 MG"; escape the dot for a RegExp. */
export const mgPattern = (mg: number) => `(^|\\s)${String(mg).replace(".", "\\.")} MG\\b`;
