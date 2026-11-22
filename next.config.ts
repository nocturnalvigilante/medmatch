import type { NextConfig } from "next";

// Security review: basic headers (no framing, no MIME sniffing, camera only for our own photo reader).
const nextConfig: NextConfig = {
  // The Indian medicine index is read from disk at runtime; ship it with every server route that uses it.
  outputFileTracingIncludes: { "/**": ["./data/india/**"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
