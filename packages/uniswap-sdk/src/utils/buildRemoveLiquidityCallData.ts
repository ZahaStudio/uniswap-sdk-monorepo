import { V4PositionManager } from "@uniswap/v4-sdk";

import { DEFAULT_SLIPPAGE_TOLERANCE } from "@/common/constants";
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
   * The deadline for the transaction. (default: 10 minutes from current block timestamp)
   */
  deadline?: string;
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
  { liquidityPercentage, deadline: deadlineParam, slippageTolerance, tokenId }: BuildRemoveLiquidityCallDataArgs,
  instance: UniswapSDKInstance,
) {
  // Get position data
  const positionData = await getPosition(tokenId, instance);
  if (!positionData) {
    throw new Error("Position not found");
  }

  const deadline = deadlineParam ?? (await getDefaultDeadline(instance)).toString();

  const { calldata, value } = V4PositionManager.removeCallParameters(positionData.position, {
    slippageTolerance: percentFromBips(slippageTolerance ?? DEFAULT_SLIPPAGE_TOLERANCE),
    deadline,
    liquidityPercentage: percentFromBips(liquidityPercentage),
    tokenId,
  });

  return {
    calldata,
    value,
  };
}
