import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_TOKENS } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";
import { describeIntegration } from "@/test/integration/integrationFlags";

jest.setTimeout(60_000);

describeIntegration("getTokens (unichain fork)", () => {
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

  it("fetches token metadata from the fork", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const tokenA = (MAINNET_TOKENS.ETH) as `0x${string}`;
    const tokenB = (MAINNET_TOKENS.USDC) as `0x${string}`;

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const [currencyA, currencyB] = await sdk.getTokens({ addresses: [tokenA, tokenB] });

    expect(currencyA.decimals).toBeGreaterThan(0);
    expect(currencyB.decimals).toBeGreaterThan(0);
    expect(currencyA.symbol).toBeDefined();
    expect(currencyB.symbol).toBeDefined();
  });
});
