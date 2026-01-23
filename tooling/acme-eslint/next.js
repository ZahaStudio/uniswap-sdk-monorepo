import eslintNext from "@next/eslint-plugin-next";

import { reactLibraryConfig } from "./react.js";

const nextRecommended = eslintNext.configs.recommended ?? {};
const nextCoreWebVitals = eslintNext.configs.coreWebVitals ?? eslintNext.configs["core-web-vitals"] ?? {};

export const nextConfig = [
  ...reactLibraryConfig,
  {
    plugins: {
      "@next/next": eslintNext,
    },
    rules: {
      ...(nextRecommended.rules ?? {}),
      ...(nextCoreWebVitals.rules ?? {}),
    },
  },
];

export default nextConfig;
