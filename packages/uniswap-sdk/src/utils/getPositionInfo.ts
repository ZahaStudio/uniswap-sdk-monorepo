import { Pool } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";

import type { GetPositionInfoResponse } from "@/common/positions";
import type { UniswapSDKInstance } from "@/core/sdk";
import { decodePositionInfo } from "@/helpers/positions";
import { getTokens } from "@/utils/getTokens";

/**
 * Retrieves basic position information.
 *
 * This method fetches raw position data from the blockchain and returns it without creating
 * SDK instances. It's more efficient when you only need position metadata (tick range, liquidity,
 * pool key) without requiring Position or Pool objects. Also fetches pool state (slot0 and liquidity)
 *
 * Use this method when:
 * - Displaying position information in a UI
 * - Checking if a position exists
 * - Getting position metadata without SDK operations
 *
 * Use `getPosition()` instead when you need SDK instances for swaps, calculations, or other operations.
 *
 * @param tokenId - The NFT token ID of the position
 * @param instance - UniswapSDKInstance
 * @returns Promise<GetPositionInfoResponse> - Basic position information with pool state
 * @throws Error if position data cannot be fetched or position doesn't exist
 */
export async function getPositionInfo(tokenId: string, instance: UniswapSDKInstance): Promise<GetPositionInfoResponse> {
  const { client, contracts } = instance;

  const { positionManager, stateView } = contracts;

  // Fetch poolKey and raw position info using multicall
  const [poolAndPositionInfo, liquidity] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: positionManager,
        abi: v4.PositionManagerArtifact.abi,
        functionName: "getPoolAndPositionInfo",
        args: [BigInt(tokenId)],
      },
      {
        address: positionManager,
        abi: v4.PositionManagerArtifact.abi,
        functionName: "getPositionLiquidity",
        args: [BigInt(tokenId)],
      },
    ],
  });

  // Decode packed position data to extract tick range
  const positionInfo = decodePositionInfo(poolAndPositionInfo[1]);
  const poolKey = poolAndPositionInfo[0];

  // Get token instances to compute poolId
  const tokens = await getTokens(
    {
      addresses: [poolKey.currency0 as `0x${string}`, poolKey.currency1 as `0x${string}`],
    },
    instance,
  );

  if (!tokens || tokens.length < 2) {
    throw new Error("Failed to fetch token instances");
  }

  const [currency0, currency1] = tokens;

  // Compute pool ID from pool key components
  const poolId = Pool.getPoolId(currency0, currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks) as `0x${string}`;

  // Fetch pool state (slot0 and liquidity) in a single multicall
  const [slot0Result, poolLiquidityResult] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getSlot0",
        args: [poolId],
      },
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getLiquidity",
        args: [poolId],
      },
    ],
  });

  const [, tick] = slot0Result;

  return {
    tokenId,
    tickLower: positionInfo.tickLower,
    tickUpper: positionInfo.tickUpper,
    liquidity,
    poolKey,
    currentTick: Number(tick),
    slot0: slot0Result,
    poolLiquidity: poolLiquidityResult,
    poolId,
    currency0,
    currency1,
  };
}
