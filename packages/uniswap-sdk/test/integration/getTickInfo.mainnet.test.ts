import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";

describe("getTickInfo (unichain fork)", () => {
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

  it("reads tick info for an uninitialized tick", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id);
    const tickInfo = await sdk.getTickInfo({
      poolKey: UNICHAIN_POOL_KEY,
      tick: 0,
    });

    expect(tickInfo.liquidityGross).toBe(0n);
    expect(tickInfo.liquidityNet).toBe(0n);
    expect(tickInfo.feeGrowthOutside0X128).toBe(0n);
    expect(tickInfo.feeGrowthOutside1X128).toBe(0n);
  });

  it("reads tick info for an initialized tick", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id);
    const tickInfo = await sdk.getTickInfo({
      poolKey: UNICHAIN_POOL_KEY,
      tick: -200680,
    });

    expect(tickInfo.liquidityGross).toBe(12245854061n);
    expect(tickInfo.liquidityNet).toBe(-1256672073n);
    expect(tickInfo.feeGrowthOutside0X128).toBe(60829862117643251366686230584285070809528n);
    expect(tickInfo.feeGrowthOutside1X128).toBe(114951898697493385668425756243053n);
  });
});
