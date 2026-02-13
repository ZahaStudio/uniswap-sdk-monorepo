import type { PermitSingle } from "@uniswap/permit2-sdk";
import { CommandType, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import type { Pool } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";

/**
 * Command codes for Universal Router operations
 * @see https://docs.uniswap.org/contracts/universal-router/technical-reference
 */
export const COMMANDS = {
  PERMIT2_PERMIT: 0x0a,
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
  V4_SWAP: 0x10,
} as const;

/**
 * Parameters for building a V4 swap
 */
export type BuildSwapCallDataArgs = {
  amountIn: bigint;
  amountOutMinimum: bigint;
  pool: Pool;
  /** The direction of the swap, true for currency0 to currency1, false for currency1 to currency0 */
  zeroForOne: boolean;
  //slippageTolerance?: number
  recipient: Address;
  /** Deadline duration in seconds from now. Defaults to 300 (5 minutes). */
  deadlineDuration?: number;
  /** Optional Permit2 signature for token approval */
  permit2Signature?: {
    signature: Hex;
    owner: Address;
    permit: PermitSingle;
  };
  /** Custom actions to override default swap behavior. If not provided, uses default SWAP_EXACT_IN_SINGLE */
  customActions?: {
    action: Actions;
    parameters: unknown[];
  }[];
};

/**
 * Builds calldata for a Uniswap V4 swap
 *
 * This function creates the necessary calldata to execute a token swap through
 * Uniswap V4's Universal Router.
 *
 * @param params - Swap configuration parameters
 * @param instance - UniswapSDKInstance for block timestamp access
 * @returns encoded calldata
 */
export async function buildSwapCallData(params: BuildSwapCallDataArgs, instance: UniswapSDKInstance): Promise<Hex> {
  const { amountIn, pool, zeroForOne, permit2Signature, recipient, amountOutMinimum, customActions, deadlineDuration } =
    params;

  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();

  // Use custom actions if provided, otherwise use default SWAP_EXACT_IN_SINGLE
  if (customActions && customActions.length > 0) {
    // Add custom actions to the planner
    for (const customAction of customActions) {
      v4Planner.addAction(customAction.action, customAction.parameters);
    }
  } else {
    v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
      {
        poolKey: pool.poolKey,
        zeroForOne,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
        hookData: "0x",
      },
    ]);
    v4Planner.addSettle(zeroForOne ? pool.currency0 : pool.currency1, true);
    v4Planner.addTake(zeroForOne ? pool.currency1 : pool.currency0, recipient);
  }

  if (permit2Signature) {
    routePlanner.addCommand(CommandType.PERMIT2_PERMIT, [permit2Signature.permit, permit2Signature.signature]);
  }

  const deadline = await getDefaultDeadline(instance, deadlineDuration);
  const encodedActions = v4Planner.finalize();

  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);

  const inputs = [permit2Signature ? routePlanner.inputs[0] : undefined, encodedActions].filter(Boolean) as Hex[];

  // Encode final calldata
  // Note: The deadline is for the execution deadline, while permit2 signatures have their own separate deadlines within the permit data structure.
  return encodeFunctionData({
    abi: utility.UniversalRouterArtifact.abi,
    functionName: "execute",
    args: [routePlanner.commands as Hex, inputs, deadline],
  });
}
