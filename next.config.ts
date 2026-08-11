import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor Cloud Agent port-forward hosts to load Next.js dev assets.
  allowedDevOrigins: [
    "*.agent.cvm.dev",
    "*.cvm.dev",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
