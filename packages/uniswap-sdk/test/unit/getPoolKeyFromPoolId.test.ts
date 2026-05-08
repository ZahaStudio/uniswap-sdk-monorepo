import type { UniswapSDKInstance } from "@/core/sdk";

import { getPoolKeyFromPoolId } from "@/utils/getPoolKeyFromPoolId";

const poolKey = {
  currency0: "0x0000000000000000000000000000000000000001",
  currency1: "0x0000000000000000000000000000000000000002",
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
} as const;

function createInstanceForChain(
  chainId: number,
  readContract = vi.fn().mockResolvedValue(Object.values(poolKey)),
): UniswapSDKInstance {
  return {
    client: { readContract },
    chain: { id: chainId },
    contracts: { positionManager: "0x0000000000000000000000000000000000000003" },
  } as unknown as UniswapSDKInstance;
}

function createPoolId(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

describe("getPoolKeyFromPoolId", () => {
  it("caches pool keys globally by chain and pool ID", async () => {
    const readContract = vi.fn().mockResolvedValue(Object.values(poolKey));
    const firstInstance = createInstanceForChain(901, readContract);
    const secondInstance = createInstanceForChain(901, readContract);
    const thirdInstance = createInstanceForChain(902, readContract);
    const poolId = createPoolId(1);

    await getPoolKeyFromPoolId(poolId, firstInstance);
    await getPoolKeyFromPoolId(poolId, firstInstance);
    await getPoolKeyFromPoolId(poolId, secondInstance);
    await getPoolKeyFromPoolId(poolId, thirdInstance);

    expect(readContract).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest cached pool key after the global cap", async () => {
    const readContract = vi.fn().mockResolvedValue(Object.values(poolKey));
    const instance = createInstanceForChain(903, readContract);

    for (let index = 1; index <= 501; index++) {
      await getPoolKeyFromPoolId(createPoolId(index), instance);
    }

    await getPoolKeyFromPoolId(createPoolId(1), instance);
    await getPoolKeyFromPoolId(createPoolId(501), instance);

    expect(readContract).toHaveBeenCalledTimes(502);
  });
});
