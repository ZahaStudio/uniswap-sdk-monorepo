import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";

jest.setTimeout(60_000);

describe("getTickInfo (unichain fork)", () => {
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

  it("reads tick info for the pool", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const tickInfo = await sdk.getTickInfo({
      poolKey: MAINNET_POOL_KEY,
      tick: 0,
    });

    expect(tickInfo.liquidityGross).toBeGreaterThanOrEqual(0n);
    expect(tickInfo.feeGrowthOutside0X128).toBeGreaterThanOrEqual(0n);
    expect(tickInfo.feeGrowthOutside1X128).toBeGreaterThanOrEqual(0n);
  });
});
