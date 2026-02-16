import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
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
