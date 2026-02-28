import { CommandType, ROUTER_AS_RECIPIENT, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import type { BatchPermitOptions, Pool } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import type { Address, Hex } from "viem";
import { encodeFunctionData } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";

/**
 * Parameters for building a V4 swap
 */
export interface BuildSwapCallDataArgs {
  amountIn: bigint;
  amountOutMinimum: bigint;
  pool: Pool;
  /** The direction of the swap, true for currency0 to currency1, false for currency1 to currency0 */
  zeroForOne: boolean;
  recipient: Address;
  /** Deadline duration in seconds from now. Defaults to 300 (5 minutes). */
  deadlineDuration?: number;
  /** Optional Permit2 batch signature for token approval */
  permit2Signature?: BatchPermitOptions;
  /** Custom actions to override default swap behavior. If not provided, uses default SWAP_EXACT_IN_SINGLE */
  customActions?: {
    action: Actions;
    parameters: unknown[];
  }[];
  /** When true, wraps/unwraps native ETH for WETH-denominated pools. The caller must send msg.value for input. */
  useNativeETH?: boolean;
}

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
  const {
    amountIn,
    pool,
    zeroForOne,
    permit2Signature,
    recipient,
    amountOutMinimum,
    customActions,
    deadlineDuration,
    useNativeETH,
  } = params;

  if (amountIn <= 0n) {
    throw new Error(`Invalid amountIn: ${amountIn}. Must be a positive value.`);
  }

  if (amountOutMinimum < 0n) {
    throw new Error(`Invalid amountOutMinimum: ${amountOutMinimum}. Must be non-negative.`);
  }

  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();

  // Determine if WRAP_ETH or UNWRAP_WETH is needed for WETH-denominated pools
  let wrapInput = false;
  let unwrapOutput = false;

  if (useNativeETH) {
    const wethAddress = instance.contracts.weth.toLowerCase();
    const inputCurrency = (zeroForOne ? pool.poolKey.currency0 : pool.poolKey.currency1).toLowerCase();
    const outputCurrency = (zeroForOne ? pool.poolKey.currency1 : pool.poolKey.currency0).toLowerCase();

    if (inputCurrency === wethAddress) {
      wrapInput = true;
    } else if (outputCurrency === wethAddress) {
      unwrapOutput = true;
    }
  }

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
    v4Planner.addSettle(zeroForOne ? pool.currency0 : pool.currency1, !wrapInput);
    v4Planner.addTake(zeroForOne ? pool.currency1 : pool.currency0, unwrapOutput ? ROUTER_AS_RECIPIENT : recipient);
  }

  const deadline = await getDefaultDeadline(instance, deadlineDuration);
  const encodedActions = v4Planner.finalize();

  // Build commands and inputs in execution order
  const finalInputs: Hex[] = [];

  if (permit2Signature) {
    routePlanner.addCommand(CommandType.PERMIT2_PERMIT_BATCH, [
      permit2Signature.permitBatch,
      permit2Signature.signature,
    ]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  if (wrapInput) {
    routePlanner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, amountIn.toString()]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
  finalInputs.push(encodedActions as Hex);

  if (unwrapOutput) {
    routePlanner.addCommand(CommandType.UNWRAP_WETH, [recipient, amountOutMinimum.toString()]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  // Encode final calldata
  // Note: The deadline is for the execution deadline, while permit2 signatures have their own separate deadlines within the permit data structure.
  return encodeFunctionData({
    abi: utility.UniversalRouterArtifact.abi,
    functionName: "execute",
    args: [routePlanner.commands as Hex, finalInputs, deadline],
  });
}
