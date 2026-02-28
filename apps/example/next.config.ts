import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGitHubPages ? "/uniswap-sdk-monorepo" : "",
  reactStrictMode: true,
  transpilePackages: ["@zahastudio/uniswap-sdk", "@zahastudio/uniswap-sdk-react"],
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    config.resolve.fallback = {
      fs: false,
      buffer: false,
      net: false,
      tls: false,
      "@react-native-async-storage/async-storage": false,
    };

    return config;
  },
};
export default nextConfig;
