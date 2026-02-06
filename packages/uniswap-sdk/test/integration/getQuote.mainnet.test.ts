import { v4 } from "hookmate/abi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";

describe("getQuote (unichain fork)", () => {
  let anvilUrl: string | null = null;
  let anvil: Awaited<ReturnType<typeof startAnvil>> | null = null;

  beforeAll(async () => {
    anvil = await startAnvil();
    anvilUrl = anvil.url;
  });

  afterAll(async () => {
    if (anvil) {
      await stopAnvil(anvil);
    }
  });

  it("returns a quote for a simple swap", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
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
