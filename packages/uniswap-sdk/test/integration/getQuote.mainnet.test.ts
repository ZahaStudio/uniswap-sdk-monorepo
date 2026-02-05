import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";
import { describeIntegration } from "@/test/integration/integrationFlags";

jest.setTimeout(60_000);

describeIntegration("getQuote (unichain fork)", () => {
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
    const quote = await sdk.getQuote({
      poolKey: MAINNET_POOL_KEY,
      zeroForOne: false,
      amountIn: "1000000",
    });

    expect(quote.amountOut).toBeGreaterThan(0n);
    expect(quote.estimatedGasUsed).toBeGreaterThan(0n);
    expect(quote.timestamp).toBeGreaterThan(0);
  });
});
