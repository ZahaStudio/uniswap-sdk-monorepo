import { Pool } from "@uniswap/v4-sdk";
import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import type { UniswapSDKInstance } from "@/core/sdk";
import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_POOL_ID, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { startForkNode, stopForkNode } from "@/test/integration/forkNode";
import { getPoolKeyFromPoolId } from "@/utils/getPoolKeyFromPoolId";

describe("getPoolKeyFromPoolId (unichain fork)", () => {
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

  it("fetches the pool key for a pool id", async () => {
    if (!forkUrl) {
      throw new Error("Fork node URL was not initialized.");
    }

    const client = createPublicClient({
      chain: unichain,
      transport: http(forkUrl),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id);
    const instance = (sdk as unknown as { instance: UniswapSDKInstance }).instance;

    const tokens = await sdk.getTokens({
      addresses: [UNICHAIN_POOL_KEY.currency0, UNICHAIN_POOL_KEY.currency1],
    });

    const poolId = Pool.getPoolId(
      tokens[0],
      tokens[1],
      UNICHAIN_POOL_KEY.fee,
      UNICHAIN_POOL_KEY.tickSpacing,
      UNICHAIN_POOL_KEY.hooks,
    ) as `0x${string}`;

    expect(poolId.toLowerCase()).toBe(UNICHAIN_POOL_ID.toLowerCase());

    const poolKey = await getPoolKeyFromPoolId(poolId, instance);

    expect(poolKey.currency0.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency0.toLowerCase());
    expect(poolKey.currency1.toLowerCase()).toBe(UNICHAIN_POOL_KEY.currency1.toLowerCase());
    expect(poolKey.fee).toBe(UNICHAIN_POOL_KEY.fee);
    expect(poolKey.tickSpacing).toBe(UNICHAIN_POOL_KEY.tickSpacing);
    expect(poolKey.hooks.toLowerCase()).toBe(UNICHAIN_POOL_KEY.hooks.toLowerCase());
  });
});
