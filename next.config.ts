// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfkit"],
  reactCompiler: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  outputFileTracingExcludes: {
    "*": ["./public/uploads/**/*", "./public/uploads"],
  },

  async rewrites() {
    return [
      {
        // Hanya intercept yang depannya /api/ai/
        source: "/api/ai/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
      {
        // Proxy khusus untuk skema Swagger UI
        source: "/api/openapi.json",
        destination: "http://localhost:8000/api/openapi.json",
      },
    ];
  },
};

export default nextConfig;
