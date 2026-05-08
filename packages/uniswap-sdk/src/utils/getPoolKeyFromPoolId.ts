import type { PoolKey } from "@uniswap/v4-sdk";

import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/core/sdk";

const poolKeyCache = new Map<string, PoolKey>();

/**
 * Retrieves the pool key information for a given pool ID.
 * @param poolId - The pool ID as a hex string
 * @param instance - UniswapSDKInstance
 * @returns Promise resolving to the pool key containing currency0, currency1, fee, tickSpacing, and hooks
 * @throws Error if pool key cannot be fetched from the contract
 */
export async function getPoolKeyFromPoolId(poolId: string, instance: UniswapSDKInstance): Promise<PoolKey> {
  const { client, contracts, chainId } = instance;
  const { positionManager } = contracts;
  const cachePoolKey = `poolKey:${chainId}:${poolId.toLowerCase()}`;
  const cached = poolKeyCache.get(cachePoolKey);
  if (cached) {
    return cached;
  }

  const poolId25Bytes = `0x${poolId.slice(2, 52)}` as `0x${string}`;

  const [currency0, currency1, fee, tickSpacing, hooks] = await client.readContract({
    address: positionManager,
    abi: v4.PositionManagerArtifact.abi,
    functionName: "poolKeys",
    args: [poolId25Bytes],
  });

  const poolKey = {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
  };

  poolKeyCache.set(cachePoolKey, poolKey);

  return poolKey;
}
