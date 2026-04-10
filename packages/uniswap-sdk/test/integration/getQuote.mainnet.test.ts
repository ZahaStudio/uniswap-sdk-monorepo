import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY, UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("getQuote (unichain rpc)", () => {
  it("returns a quote for a single-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const amountIn = "1000000";
    const expectedAmountOut = 518374739793346n;

    const block = await client.getBlock();
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      currencyIn: UNICHAIN_TOKENS.USDC,
      route: [{ poolKey: UNICHAIN_POOL_KEY }],
      amountIn,
    });

    vi.useRealTimers();

    expect(quote.amountOut).toBe(expectedAmountOut);
    expect(quote.timestamp).toBe(blockTimestampMs);
  });
});
