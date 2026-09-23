import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node-postgres opens native sockets and must stay a real server-side require
  // rather than being traced into the bundle.
  serverExternalPackages: ["pg", "cloudinary"],

  images: {
    // Every uploaded image is delivered from Cloudinary; the demo/seed content
    // points at Unsplash, which Cloudinary can also fetch through.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },

  experimental: {
    // Admin forms post their images through Server Actions, so the default 1 MB
    // body limit is too small for a photograph straight off a phone.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
