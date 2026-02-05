import { createPublicClient, http, zeroAddress } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";
import { describeIntegration } from "@/test/integration/integrationFlags";

jest.setTimeout(60_000);

describeIntegration("getPool (unichain fork)", () => {
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

  it("fetches a pool", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const pool = await sdk.getPool({
      currencyA: MAINNET_POOL_KEY.currency0,
      currencyB: MAINNET_POOL_KEY.currency1,
      fee: MAINNET_POOL_KEY.fee,
      tickSpacing: MAINNET_POOL_KEY.tickSpacing,
      hooks: MAINNET_POOL_KEY.hooks,
    });

    expect(pool.fee).toBe(MAINNET_POOL_KEY.fee);
    expect(pool.tickSpacing).toBe(MAINNET_POOL_KEY.tickSpacing);
    const poolCurrency0Address = pool.currency0.isNative ? zeroAddress : pool.currency0.address;
    const poolCurrency1Address = pool.currency1.isNative ? zeroAddress : pool.currency1.address;

    expect(poolCurrency0Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency0.toLowerCase());
    expect(poolCurrency1Address.toLowerCase()).toBe(MAINNET_POOL_KEY.currency1.toLowerCase());
    expect(BigInt(pool.liquidity.toString())).toBeGreaterThan(0n);
  });
});
