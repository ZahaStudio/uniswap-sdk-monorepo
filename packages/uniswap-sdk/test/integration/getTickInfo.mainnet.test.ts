import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_FORK_BLOCK_NUMBER, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";

const UNICHAIN_RPC_URL = "https://unichain.drpc.org";
const PINNED_BLOCK_NUMBER = BigInt(UNICHAIN_FORK_BLOCK_NUMBER);

describe("getTickInfo (unichain rpc)", () => {
  it("reads tick info for an uninitialized tick", async () => {
    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
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
    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
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
