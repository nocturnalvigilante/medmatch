import type { MetadataRoute } from "next";

// Installable on a phone's home screen, so parents can open it like an app at the pharmacy.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedMatch: Indian medicines in the US",
    short_name: "MedMatch",
    description: "Find the US name of your Indian medicine and what to ask the pharmacist for.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
