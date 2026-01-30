import type { PoolKey } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/core/sdk";

/**
 * Parameters required for retrieving pool key information.
 */
export interface GetPoolKeyFromPoolIdParams {
  /** The 32-byte pool ID in hex format (0x...) */
  poolId: `0x${string}`;
}

/**
 * Retrieves the pool key information for a given pool ID.
 * @param params Parameters containing the pool ID
 * @returns Promise resolving to the pool key containing currency0, currency1, fee, tickSpacing, and hooks
 * @throws Error if SDK instance is not found
 */
export async function getPoolKeyFromPoolId(poolId: string, instance: UniswapSDKInstance): Promise<PoolKey> {
  const { client, contracts } = instance;
  const { positionManager } = contracts;

  const poolId25Bytes = `0x${poolId.slice(2, 52)}` as `0x${string}`;

  const [currency0, currency1, fee, tickSpacing, hooks] = await client.readContract({
    address: positionManager,
    abi: v4.PositionManagerArtifact.abi,
    functionName: "poolKeys",
    args: [poolId25Bytes],
  });

  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
  };
}
