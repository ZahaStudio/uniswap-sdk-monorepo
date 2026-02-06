import { v4 } from "hookmate/abi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

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
      chain: mainnet,
      transport: http(forkUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const amountIn = "1000000";
    const quoteParams = {
      poolKey: {
        currency0: MAINNET_POOL_KEY.currency0 as `0x${string}`,
        currency1: MAINNET_POOL_KEY.currency1 as `0x${string}`,
        fee: MAINNET_POOL_KEY.fee,
        tickSpacing: MAINNET_POOL_KEY.tickSpacing,
        hooks: MAINNET_POOL_KEY.hooks as `0x${string}`,
      },
      zeroForOne: false,
      exactAmount: BigInt(amountIn),
      hookData: "0x" as `0x${string}`,
    };

    const [expectedAmountOut, expectedGasUsed] = await client
      .simulateContract({
        address: sdk.getContractAddress("quoter"),
        abi: v4.QuoterArtifact.abi,
        functionName: "quoteExactInputSingle",
        args: [quoteParams],
      })
      .then((simulation) => simulation.result);

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
