"use client";

import { type PropsWithChildren } from "react";

import { darkTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TradingSDKProvider } from "@zahastudio/trading-sdk-react";
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

const tradingApiKey = process.env.NEXT_PUBLIC_UNISWAP_API_KEY;

export function Providers({ children }: PropsWithChildren) {
  const sdkTree = (
    <UniswapSDKProvider>
      {tradingApiKey ? (
        <TradingSDKProvider config={{ apiKey: tradingApiKey }}>{children}</TradingSDKProvider>
      ) : (
        children
      )}
    </UniswapSDKProvider>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <RainbowKitProvider theme={darkTheme()}>{sdkTree}</RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}
