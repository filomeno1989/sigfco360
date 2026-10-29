import type { NextConfig } from "next";

// "standalone" serve apenas para self-hosting (servidor próprio / testes
// locais). Na Vercel o runtime é gerido pela plataforma e o output deve
// ficar com o padrão do framework.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
};

export default nextConfig;
