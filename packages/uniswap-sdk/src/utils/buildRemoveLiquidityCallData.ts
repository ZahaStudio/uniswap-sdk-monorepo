import { V4PositionManager } from "@uniswap/v4-sdk";

import type { UniswapSDKInstance } from "@/core/sdk";
import { percentFromBips } from "@/helpers/percent";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { getPosition } from "@/utils/getPosition";

/**
 * Parameters required to build the calldata for removing liquidity from a Uniswap v4 position.
 */
export interface BuildRemoveLiquidityCallDataArgs {
  /**
   * The percentage of liquidity to remove from the position.
   */
  liquidityPercentage: number;

  /**
   * The tokenId of the position to remove liquidity from.
   */
  tokenId: string;

  /**
   * The slippage tolerance for the transaction.
   */
  slippageTolerance?: number;

  /**
   * Deadline duration in seconds from current block timestamp.
   * Defaults to the SDK instance's defaultDeadline (600 = 10 minutes).
   */
  deadlineDuration?: number;
}

/**
 * Builds the calldata and value required to remove liquidity from a Uniswap v4 position.
 *
 * @param params - The parameters for removing liquidity.
 * @returns An object containing the calldata and the value to send with the transaction.
 *
 * @example
 * ```typescript
 * const { calldata, value } = buildRemoveLiquidityCallData({
 *   position,
 *   liquidityPercentage: 10_000, // 100%
 * });
 *
 * const tx = await sendTransaction({
 *   to: PositionManager.address,
 *   data: calldata,
 *   value: value,
 * });
 * ```
 */
export async function buildRemoveLiquidityCallData(
  { liquidityPercentage, deadlineDuration, slippageTolerance, tokenId }: BuildRemoveLiquidityCallDataArgs,
  instance: UniswapSDKInstance,
) {
  // Get position data
  const positionData = await getPosition(tokenId, instance);
  if (!positionData) {
    throw new Error("Position not found");
  }

  const deadline = (await getDefaultDeadline(instance, deadlineDuration)).toString();

  const { calldata, value } = V4PositionManager.removeCallParameters(positionData.position, {
    slippageTolerance: percentFromBips(slippageTolerance ?? instance.defaultSlippageTolerance),
    deadline,
    liquidityPercentage: percentFromBips(liquidityPercentage),
    tokenId,
  });

  return {
    calldata,
    value,
  };
}
