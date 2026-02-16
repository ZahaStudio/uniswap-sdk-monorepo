import { type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import { hashFn } from "wagmi/query";

import { UniswapSDKProvider } from "@/provider";
import { createIntegrationWagmiConfig } from "@/test/integration/wagmiConfig";

export function createIntegrationWrapper(config: Config = createIntegrationWagmiConfig()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        queryKeyHashFn: hashFn,
      },
      mutations: {},
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <UniswapSDKProvider>{children}</UniswapSDKProvider>
        </QueryClientProvider>
      </WagmiProvider>
    );
  }

  return {
    wrapper: Wrapper,
    queryClient,
    config,
  };
}
