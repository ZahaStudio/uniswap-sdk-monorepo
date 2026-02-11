"use client";

import { createConfig, http } from "wagmi";
import { mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const mainnetRpcUrl = process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "http://127.0.0.1:8545";

export const wagmiConfig = createConfig({
  chains: [mainnet],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(mainnetRpcUrl),
  },
  ssr: true,
});
