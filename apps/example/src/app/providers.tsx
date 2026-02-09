"use client";

import { type ReactNode } from "react";

import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniswapSDKProvider } from "@zahastudio/uniswap-sdk-react";
import { WagmiProvider } from "wagmi";
import { hashFn } from "wagmi/query";

import { wagmiConfig } from "@/lib/wagmi";

import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      queryKeyHashFn: hashFn,
    },
    mutations: {},
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider>
          <UniswapSDKProvider>{children}</UniswapSDKProvider>
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
