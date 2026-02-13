/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      wagmi: "@zahastudio/uniswap-sdk-react/node_modules/wagmi",
      "wagmi/query": "@zahastudio/uniswap-sdk-react/node_modules/wagmi/query",
    },
  },
  transpilePackages: ["@zahastudio/uniswap-sdk", "@zahastudio/uniswap-sdk-react"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: require.resolve("@zahastudio/uniswap-sdk-react/node_modules/wagmi"),
      "wagmi/query": require.resolve("@zahastudio/uniswap-sdk-react/node_modules/wagmi/query"),
    };

    return config;
  },
};
