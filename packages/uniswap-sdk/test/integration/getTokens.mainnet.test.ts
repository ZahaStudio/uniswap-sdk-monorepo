import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_FORK_BLOCK_NUMBER, UNICHAIN_TOKENS } from "@/test/fixtures/unichain";

const UNICHAIN_RPC_URL = "https://unichain.drpc.org";
const PINNED_BLOCK_NUMBER = BigInt(UNICHAIN_FORK_BLOCK_NUMBER);

describe("getTokens (unichain rpc)", () => {
  it("fetches token metadata from rpc", async () => {
    const tokenA = UNICHAIN_TOKENS.ETH as `0x${string}`;
    const tokenB = UNICHAIN_TOKENS.USDC as `0x${string}`;

    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
    const [currencyA, currencyB] = await sdk.getTokens({ addresses: [tokenA, tokenB] });

    expect(currencyA.symbol).toBe("ETH");
    expect(currencyA.decimals).toBe(18);
    expect(currencyA.name).toBe("Ether");

    expect(currencyB.symbol).toBe("USDC");
    expect(currencyB.name).toBe("USDC");
    expect(currencyB.decimals).toBe(6);
  });
});
