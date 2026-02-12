import { v4 } from "hookmate/abi";
import { pad, toHex } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { getPositionInfo } from "@/utils/getPositionInfo";

const Q128 = 2n ** 128n;
const MASK_256 = (1n << 256n) - 1n;

export interface GetUncollectedFeesResponse {
  amount0: bigint;
  amount1: bigint;
}

/**
 * Calculates uncollected (accrued but not yet collected) fees for a given position NFT.
 *
 * Uses StateView.getPositionInfo to get the position's last fee growth snapshot,
 * and StateView.getFeeGrowthInside to get the current fee growth inside the tick range.
 * The difference, multiplied by liquidity, gives the uncollected fees.
 *
 * @param tokenId - The NFT token ID of the position
 * @param instance - UniswapSDKInstance
 * @returns Promise<GetUncollectedFeesResponse> - Uncollected fee amounts for both tokens
 * @throws Error if position data cannot be fetched
 */
export async function getUncollectedFees(
  tokenId: string,
  instance: UniswapSDKInstance,
): Promise<GetUncollectedFeesResponse> {
  const { client, contracts, blockNumber } = instance;
  const { positionManager, stateView } = contracts;

  // Step 1: Get position info (poolId, tickLower, tickUpper, liquidity, poolKey)
  const positionInfo = await getPositionInfo(tokenId, instance);
  const { poolId, tickLower, tickUpper, liquidity } = positionInfo;

  // Derive salt from tokenId (bytes32 encoding of the NFT token ID)
  const salt = pad(toHex(BigInt(tokenId)), { size: 32 });

  // Step 2: Multicall to StateView for fee growth snapshots and current fee growth
  const [stateViewPositionInfo, feeGrowthInside] = await client.multicall({
    blockNumber,
    allowFailure: false,
    contracts: [
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getPositionInfo",
        args: [poolId, positionManager, tickLower, tickUpper, salt],
      },
      {
        address: stateView,
        abi: v4.StateViewArtifact.abi,
        functionName: "getFeeGrowthInside",
        args: [poolId, tickLower, tickUpper],
      },
    ],
  });

  // stateViewPositionInfo = [liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128]
  const feeGrowthInside0LastX128 = stateViewPositionInfo[1];
  const feeGrowthInside1LastX128 = stateViewPositionInfo[2];

  // feeGrowthInside = [feeGrowthInside0X128, feeGrowthInside1X128]
  const feeGrowthInside0X128 = feeGrowthInside[0];
  const feeGrowthInside1X128 = feeGrowthInside[1];

  // Step 3: Calculate uncollected fees using modular uint256 arithmetic
  const delta0 = (feeGrowthInside0X128 - feeGrowthInside0LastX128) & MASK_256;
  const delta1 = (feeGrowthInside1X128 - feeGrowthInside1LastX128) & MASK_256;

  // FullMath.mulDiv(delta, liquidity, Q128)
  const amount0 = (delta0 * liquidity) / Q128;
  const amount1 = (delta1 * liquidity) / Q128;

  return { amount0, amount1 };
}
