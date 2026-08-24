import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cursor Cloud Agent / tunnel hosts to load Next.js dev assets.
  allowedDevOrigins: [
    "*.agent.cvm.dev",
    "*.cvm.dev",
    "*.trycloudflare.com",
    "*.loca.lt",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
