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
      // /api/v1/process-batch is handled by our route (credit check + proxy)
      // /api/auth/* and /api/webhook/* are Next.js routes (NextAuth, Stripe)
    ];
  },
};

export default nextConfig;
