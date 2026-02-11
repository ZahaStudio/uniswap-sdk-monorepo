"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { mainnet } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName: "Uniswap SDK Example",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "demo",
  chains: [mainnet],
  transports: {
    [mainnet.id]: http("https://virtual.mainnet.eu.rpc.tenderly.co/20ddfe93-89e7-4457-bca0-6dc140c75c13"),
  },
  ssr: true,
});
