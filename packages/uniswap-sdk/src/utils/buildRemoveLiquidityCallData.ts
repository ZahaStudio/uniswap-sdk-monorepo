import { V4PositionManager } from "@uniswap/v4-sdk";

import { DEFAULT_SLIPPAGE_TOLERANCE } from "@/constants/common";
import { percentFromBips } from "@/helpers/percent";
import type { UniDevKitV4Instance } from "@/types";
import type { BuildRemoveLiquidityCallDataArgs } from "@/types/utils/buildRemoveLiquidityCallData";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { getPosition } from "@/utils/getPosition";

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
  instance: UniDevKitV4Instance,
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
