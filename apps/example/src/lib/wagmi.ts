"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Uniswap SDK Example",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "demo",
  chains: [mainnet],
  transports: {
    [mainnet.id]: http("https://mainnet.gateway.tenderly.co"),
  },
  ssr: true,
});
