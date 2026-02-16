"use client";

import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "Uniswap SDK Example",
    projectId: "demo", // This is not really required since we aren't use WC connector at all.
    walletConnectParameters: {
      disableProviderPing: true,
      telemetryEnabled: false,
    },
  },
);

export const wagmiConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
  },
  connectors,
  ssr: false,
});
