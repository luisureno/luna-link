import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@react-pdf/renderer',
    '@anthropic-ai/sdk',
    'exceljs',
    'canvas',
  ],
};

export default nextConfig;
