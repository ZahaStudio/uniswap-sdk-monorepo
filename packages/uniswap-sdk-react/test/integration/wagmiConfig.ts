import { http } from "viem";
import { createConfig } from "wagmi";
import { unichain } from "wagmi/chains";

import { UNICHAIN_RPC_URL } from "@/test/fixtures/unichain";

export function createIntegrationWagmiConfig() {
  return createConfig({
    chains: [unichain],
    transports: {
      [unichain.id]: http(UNICHAIN_RPC_URL),
    },
    ssr: false,
  });
}
