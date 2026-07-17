// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // ✅ FIX: Cegah Turbopack scan folder public/uploads (symlink ke luar project)
  // Tanpa ini, build akan CRASH karena Turbopack menemukan symlink yang
  // "menunjuk keluar dari filesystem root project".
  outputFileTracingExcludes: {
    "*": [
      "./public/uploads/**/*",
      "./public/uploads",
    ],
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
