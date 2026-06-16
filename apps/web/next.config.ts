import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace-pakker som leveres som TS-kilde (transpileres av Next).
  transpilePackages: ["@qa/ui", "@qa/core"],
};

export default nextConfig;
