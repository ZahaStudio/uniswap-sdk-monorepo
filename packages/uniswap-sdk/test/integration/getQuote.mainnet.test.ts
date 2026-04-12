import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY, UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";
import { TradeType } from "@/types/tradeType";

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
      tradeType: TradeType.ExactInput,
      currencyIn: UNICHAIN_TOKENS.USDC,
      route: [{ poolKey: UNICHAIN_POOL_KEY }],
      amountIn,
    });

    vi.useRealTimers();

    expect(quote.amountOut).toBe(expectedAmountOut);
    expect(quote.amountIn).toBe(BigInt(amountIn));
    expect(quote.tradeType).toBe(TradeType.ExactInput);
    expect(quote.timestamp).toBe(blockTimestampMs);
  });

  it("returns an exact-output quote for a single-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const amountOut = "518374739793346";
    const expectedAmountIn = 1_000_000n;

    const block = await client.getBlock();
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      tradeType: TradeType.ExactOutput,
      currencyOut: UNICHAIN_TOKENS.ETH,
      route: [{ poolKey: UNICHAIN_POOL_KEY }],
      amountOut,
    });

    vi.useRealTimers();

    expect(quote.amountIn).toBe(expectedAmountIn);
    expect(quote.amountOut).toBe(BigInt(amountOut));
    expect(quote.tradeType).toBe(TradeType.ExactOutput);
    expect(quote.timestamp).toBe(blockTimestampMs);
  });
});
