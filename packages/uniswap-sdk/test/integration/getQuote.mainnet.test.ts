import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY, UNICHAIN_TOKENS } from "@/test/fixtures/unichain";
import { createPinnedUnichainClient } from "@/test/integration/pinnedClient";

describe("getQuote (unichain rpc)", () => {
  it("returns a quote for a single-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const amount = "1000000";
    const expectedAmountOut = 518374739793346n;

    const block = await client.getBlock();
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      route: [{ poolKey: UNICHAIN_POOL_KEY }],
      exactInput: {
        currency: UNICHAIN_TOKENS.USDC,
        amount,
      },
    });

    vi.useRealTimers();

    expect(quote.amountOut).toBe(expectedAmountOut);
    expect(quote.amountIn).toBe(BigInt(amount));
    expect(quote.meta).toEqual({
      resolvedCurrencyIn: UNICHAIN_TOKENS.USDC,
      resolvedCurrencyOut: UNICHAIN_TOKENS.ETH,
    });
    expect(quote.timestamp).toBe(blockTimestampMs);
  });

  it("returns an exact-output quote for a single-hop route", async () => {
    const client = createPinnedUnichainClient();
    const sdk = UniswapSDK.create(client, unichain.id);
    const amount = "518374739793346";
    const expectedAmountIn = 1_000_000n;

    const block = await client.getBlock();
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      route: [{ poolKey: UNICHAIN_POOL_KEY }],
      exactOutput: {
        currency: UNICHAIN_TOKENS.ETH,
        amount,
      },
    });

    vi.useRealTimers();

    expect(quote.amountIn).toBe(expectedAmountIn);
    expect(quote.amountOut).toBe(BigInt(amount));
    expect(quote.meta).toEqual({
      resolvedCurrencyIn: UNICHAIN_TOKENS.USDC,
      resolvedCurrencyOut: UNICHAIN_TOKENS.ETH,
    });
    expect(quote.timestamp).toBe(blockTimestampMs);
  });
});
