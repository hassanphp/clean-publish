import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      // Proxy backend routes (except process-batch which we handle for credits)
      { source: "/api/v1/analyze-images", destination: `${apiUrl}/api/v1/analyze-images` },
      { source: "/api/v1/regenerate", destination: `${apiUrl}/api/v1/regenerate` },
      { source: "/api/v1/jobs/:path*", destination: `${apiUrl}/api/v1/jobs/:path*` },
      { source: "/api/v1/dealers/:path*", destination: `${apiUrl}/api/v1/dealers/:path*` },
      { source: "/api/v1/webhooks/:path*", destination: `${apiUrl}/api/v1/webhooks/:path*` },
      { source: "/api/v1/projects", destination: `${apiUrl}/api/v1/projects` },
      { source: "/api/v1/projects/:path*", destination: `${apiUrl}/api/v1/projects/:path*` },
      { source: "/api/v1/storage/:path*", destination: `${apiUrl}/api/v1/storage/:path*` },
      { source: "/api/v1/billing/:path*", destination: `${apiUrl}/api/v1/billing/:path*` },
      { source: "/api/v1/auth/:path*", destination: `${apiUrl}/api/v1/auth/:path*` },
      // /api/v1/process-batch is handled by our route (credit check + proxy)
    ];
  },
};

export default nextConfig;
