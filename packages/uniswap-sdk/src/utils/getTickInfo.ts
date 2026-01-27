import { Pool } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";

import type { UniDevKitV4Instance } from "@/types/core";
import type { GetTickInfoArgs, TickInfoResponse } from "@/types/utils/getTickInfo";
import { getTokens } from "@/utils/getTokens";

/**
 * Reads tick info for a given pool key and tick from V4 StateView.
 */
export async function getTickInfo(args: GetTickInfoArgs, instance: UniDevKitV4Instance): Promise<TickInfoResponse> {
  const { client, contracts } = instance;
  const { stateView } = contracts;

  const { poolKey, tick } = args;

  // Create Token instances for currency0 and currency1 in the provided order
  const tokens = await getTokens(
    { addresses: [poolKey.currency0 as `0x${string}`, poolKey.currency1 as `0x${string}`] },
    instance,
  );

  if (!tokens || tokens.length < 2) {
    throw new Error("Failed to fetch token instances");
  }

  const [currency0, currency1] = tokens;

  // Compute PoolId from PoolKey components
  const poolId32Bytes = Pool.getPoolId(
    currency0,
    currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks as `0x${string}`,
  ) as `0x${string}`;

  // Read tick info
  const result = await client.readContract({
    address: stateView,
    abi: v4.StateViewArtifact.abi,
    functionName: "getTickInfo",
    args: [poolId32Bytes, tick],
  });

  // V4 StateView getTickInfo returns:
  // (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)
  const [liquidityGross, liquidityNet, feeGrowthOutside0X128, feeGrowthOutside1X128] = result as unknown as [
    bigint,
    bigint,
    bigint,
    bigint,
  ];

  return {
    liquidityGross,
    liquidityNet,
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
  };
}
