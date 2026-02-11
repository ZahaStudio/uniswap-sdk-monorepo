import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";

describe("getQuote (unichain fork)", () => {
  let forkUrl: string | null = null;
  let forkNode: Awaited<ReturnType<typeof startForkNode>> | null = null;

  beforeAll(async () => {
    forkNode = await startForkNode();
    forkUrl = forkNode.url;
  });

  afterAll(async () => {
    if (forkNode) {
      await stopForkNode(forkNode);
    }
  });

  it("returns a quote for a simple swap", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id);
    const amountIn = "1000000";
    const expectedAmountOut = 518374739793346n;
    const expectedGasUsed = 37263n;

    const block = await client.getBlock();
    const blockTimestampMs = Number(block.timestamp) * 1000;

    vi.useFakeTimers();
    vi.setSystemTime(blockTimestampMs);

    const quote = await sdk.getQuote({
      poolKey: MAINNET_POOL_KEY,
      zeroForOne: false,
      amountIn,
    });

    vi.useRealTimers();

    expect(quote.amountOut).toBe(expectedAmountOut);
    expect(quote.estimatedGasUsed).toBe(expectedGasUsed);
    expect(quote.timestamp).toBe(blockTimestampMs);
  });
});
