import { V4PositionManager } from "@uniswap/v4-sdk";

import type { UniswapSDKInstance } from "@/core/sdk";
import { percentFromBips } from "@/helpers/percent";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { getPosition } from "@/utils/getPosition";

/**
 * Parameters required to build the calldata for collecting fees from a Uniswap v4 position.
 */
export interface BuildCollectFeesCallDataArgs {
  /**
   * The tokenId of the position to collect fees from.
   */
  tokenId: string;

  /**
   * The recipient address for collected fees.
   */
  recipient: string;

  /**
   * Deadline duration in seconds from current block timestamp.
   * Defaults to the SDK instance's defaultDeadline (600 = 10 minutes).
   */
  deadlineDuration?: number;
}

/**
 * Builds the calldata and value required to collect fees from a Uniswap v4 position.
 *
 * @param params - The parameters for collecting fees.
 * @param instance - UniswapSDKInstance for accessing pool state.
 * @returns An object containing the calldata and the value to send with the transaction.
 *
 * @example
 * ```ts
 * const { calldata, value } = await buildCollectFeesCallData({
 *   tokenId: '1234',
 *   recipient: userAddress,
 *   deadlineDuration: 600, // 10 minutes
 * }, instance)
 *
 * const tx = await sendTransaction({
 *   to: PositionManager.address,
 *   data: calldata,
 *   value,
 * })
 * ```
 */
export async function buildCollectFeesCallData(
  { tokenId, recipient, deadlineDuration }: BuildCollectFeesCallDataArgs,
  instance: UniswapSDKInstance,
) {
  const positionData = await getPosition(tokenId, instance);
  if (!positionData) {
    throw new Error("Position not found");
  }

  const deadline = (await getDefaultDeadline(instance, deadlineDuration)).toString();

  try {
    const { calldata, value } = V4PositionManager.collectCallParameters(positionData.position, {
      tokenId,
      recipient,
      slippageTolerance: percentFromBips(0),
      deadline,
      hookData: "0x",
    });

    return {
      calldata,
      value,
    };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
