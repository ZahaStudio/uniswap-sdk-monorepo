import { V4PositionManager } from "@uniswap/v4-sdk";

import type { UniswapSDKInstance } from "@/core/sdk";
import type { BuildCallDataResult } from "@/utils/buildAddLiquidityCallData";

import { assertBasisPoints, percentFromBips } from "@/helpers/percent";
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
 * const { calldata, value } = await buildRemoveLiquidityCallData({
 *   tokenId: "12345",
 *   liquidityPercentage: 10_000, // 100%
 * }, instance);
 *
 * const tx = await sendTransaction({
 *   to: PositionManager.address,
 *   data: calldata,
 *   value: BigInt(value),
 * });
 * ```
 */
export async function buildRemoveLiquidityCallData(
  { liquidityPercentage, deadlineDuration, slippageTolerance, tokenId }: BuildRemoveLiquidityCallDataArgs,
  instance: UniswapSDKInstance,
): Promise<BuildCallDataResult> {
  assertBasisPoints(liquidityPercentage, "liquidityPercentage");

  const resolvedSlippage = slippageTolerance ?? instance.defaultSlippageTolerance;
  assertBasisPoints(resolvedSlippage, "slippageTolerance");

  const positionData = await getPosition(tokenId, instance);

  const deadline = (await getDefaultDeadline(instance, deadlineDuration)).toString();

  const { calldata, value } = V4PositionManager.removeCallParameters(positionData.position, {
    slippageTolerance: percentFromBips(resolvedSlippage),
    deadline,
    liquidityPercentage: percentFromBips(liquidityPercentage),
    tokenId,
  });

  return {
    calldata,
    value,
  };
}
