import { Pool } from "@uniswap/v4-sdk";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

import type { UniswapSDKInstance } from "@/core/sdk";
import { UniswapSDK } from "@/core/sdk";
import { MAINNET_POOL_ID, MAINNET_POOL_KEY } from "@/test/fixtures/mainnet";
import { startAnvil, stopAnvil } from "@/test/integration/anvil";
import { getPoolKeyFromPoolId } from "@/utils/getPoolKeyFromPoolId";

describe("getPoolKeyFromPoolId (unichain fork)", () => {
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

  it("fetches the pool key for a pool id", async () => {
    if (!anvilUrl) {
      throw new Error("Anvil URL was not initialized.");
    }

    const client = createPublicClient({
      chain: mainnet,
      transport: http(anvilUrl),
    });

    const sdk = await UniswapSDK.create(client);
    const instance = (sdk as unknown as { instance: UniswapSDKInstance }).instance;

    const tokens = await sdk.getTokens({
      addresses: [MAINNET_POOL_KEY.currency0, MAINNET_POOL_KEY.currency1],
    });

    const poolId = Pool.getPoolId(
      tokens[0],
      tokens[1],
      MAINNET_POOL_KEY.fee,
      MAINNET_POOL_KEY.tickSpacing,
      MAINNET_POOL_KEY.hooks,
    ) as `0x${string}`;

    expect(poolId.toLowerCase()).toBe(MAINNET_POOL_ID.toLowerCase());

    const poolKey = await getPoolKeyFromPoolId(poolId, instance);

    expect(poolKey.currency0.toLowerCase()).toBe(MAINNET_POOL_KEY.currency0.toLowerCase());
    expect(poolKey.currency1.toLowerCase()).toBe(MAINNET_POOL_KEY.currency1.toLowerCase());
    expect(poolKey.fee).toBe(MAINNET_POOL_KEY.fee);
    expect(poolKey.tickSpacing).toBe(MAINNET_POOL_KEY.tickSpacing);
    expect(poolKey.hooks.toLowerCase()).toBe(MAINNET_POOL_KEY.hooks.toLowerCase());
  });
});
