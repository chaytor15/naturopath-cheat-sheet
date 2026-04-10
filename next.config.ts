import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Avoid Turbopack bundling googleapis (fixes Vercel "Can't resolve 'googleapis'")
  serverExternalPackages: ["googleapis"],
};

export default nextConfig;
