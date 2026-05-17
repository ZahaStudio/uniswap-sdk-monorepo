"use client";

import { type ReactNode, useState } from "react";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniswapSDKProvider } from "@zahastudio/uniswap-sdk-react";
import { WagmiProvider, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import "@rainbow-me/rainbowkit/styles.css";

const mainnetRpcUrl = import.meta.env.VITE_MAINNET_RPC_URL as string | undefined;

const wagmiConfig = getDefaultConfig({
  appName: "Zaha Uniswap SDK",
  projectId: "demo",
  chains: [mainnet],
  ssr: false,
  transports: {
    [mainnet.id]: http(mainnetRpcUrl),
  },
});

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <UniswapSDKProvider
          config={{
            defaultSlippageTolerance: 50,
          }}
        >
          <RainbowKitProvider initialChain={mainnet}>{children}</RainbowKitProvider>
        </UniswapSDKProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
