"use client";

import type { PropsWithChildren } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniswapSDKProvider } from "@zahastudio/uniswap-sdk-react";
import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <UniswapSDKProvider>{children}</UniswapSDKProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </body>
    </html>
  );
}
