import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8000/api/:path*', // <-- Ganti 8000 dengan port backend FastAPI-mu
      },
    ];
  },
};

export default nextConfig;
