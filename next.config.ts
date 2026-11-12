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
    // A notice can include an 8 MB photograph and an 8 MB attachment in one multipart request.
    serverActions: { bodySizeLimit: "17mb" },
  },
};

export default nextConfig;
