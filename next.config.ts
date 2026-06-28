import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tell Next.js/Vercel's file tracer to explicitly include the Linux x64 ffprobe binary
  // from ffprobe-static. Without this, NFT cannot statically determine which platform
  // binary to bundle since ffprobe-static resolves the path dynamically at runtime
  // using os.platform() + os.arch().
  outputFileTracingIncludes: {
    "/api/sync": ["./node_modules/ffprobe-static/bin/linux/x64/ffprobe"],
    "/api/stream-remux/[id]": ["./node_modules/ffprobe-static/bin/linux/x64/ffprobe"],
  },
};

export default nextConfig;
