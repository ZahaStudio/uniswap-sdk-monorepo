import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: ["@zahastudio/uniswap-sdk", "@zahastudio/uniswap-sdk-react"],
};
export default nextConfig;
