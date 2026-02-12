import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_FORK_BLOCK_NUMBER, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";

const UNICHAIN_RPC_URL = "https://unichain.drpc.org";
const PINNED_BLOCK_NUMBER = BigInt(UNICHAIN_FORK_BLOCK_NUMBER);

describe("getQuote (unichain rpc)", () => {
  it("returns a quote for a simple swap", async () => {
    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
    const amountIn = "1000000";
    const expectedAmountOut = 518374739793346n;
    const expectedGasUsed = 37263n;

    const block = await client.getBlock({ blockNumber: PINNED_BLOCK_NUMBER });
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      poolKey: UNICHAIN_POOL_KEY,
      zeroForOne: false,
      amountIn,
    });

    vi.useRealTimers();

    expect(quote.amountOut).toBe(expectedAmountOut);
    expect(quote.estimatedGasUsed).toBe(expectedGasUsed);
    expect(quote.timestamp).toBe(blockTimestampMs);
  });
});
