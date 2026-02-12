import { Pool } from "@uniswap/v4-sdk";
import { type PublicClient, createPublicClient, http } from "viem";
import { unichain } from "viem/chains";

import type { UniswapSDKInstance } from "@/core/sdk";
import { UniswapSDK } from "@/core/sdk";
import { UNICHAIN_FORK_BLOCK_NUMBER, UNICHAIN_POOL_ID, UNICHAIN_POOL_KEY } from "@/test/fixtures/unichain";
import { getPoolKeyFromPoolId } from "@/utils/getPoolKeyFromPoolId";

const UNICHAIN_RPC_URL = "https://unichain.drpc.org";
const PINNED_BLOCK_NUMBER = BigInt(UNICHAIN_FORK_BLOCK_NUMBER);

describe("getPoolKeyFromPoolId (unichain rpc)", () => {
  it("fetches the pool key for a pool id", async () => {
    const client = createPublicClient({
      chain: unichain,
      transport: http(UNICHAIN_RPC_URL),
    }) as PublicClient;

    const sdk = UniswapSDK.create(client, unichain.id, undefined, undefined, PINNED_BLOCK_NUMBER);
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
