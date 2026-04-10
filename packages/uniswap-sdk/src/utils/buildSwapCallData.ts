import type { BatchPermitOptions, Pool } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

import { CommandType, ROUTER_AS_RECIPIENT, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import { encodeFunctionData } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { mapRoute, resolveSwapRoute, type SwapRouteWithPools } from "@/utils/swapRoute";

/**
 * Parameters for building a V4 swap
 */
export interface BuildSwapCallDataArgs {
  amountIn: bigint;
  amountOutMinimum: bigint;
  /** Input currency for the first hop in the route. */
  currencyIn: Address;
  /** Ordered list of pools to route through. A single-hop swap is a route with one entry. */
  route: SwapRouteWithPools;
  recipient: Address;
  /** Deadline duration in seconds from now. Defaults to 300 (5 minutes). */
  deadlineDuration?: number;
  /** Optional Permit2 batch signature for token approval */
  permit2Signature?: BatchPermitOptions;
  /** Custom actions to override default swap behavior. If not provided, uses default SWAP_EXACT_IN. */
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
    currencyIn,
    route,
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
  const routeWithPoolKeys = mapRoute(route, ({ pool, hookData }) => ({ poolKey: pool.poolKey, hookData }));
  const { path, outputCurrency } = resolveSwapRoute(currencyIn, routeWithPoolKeys);
  const inputPool = route[0].pool;
  const outputPool = route[route.length - 1]!.pool;
  const inputCurrencyObject = getRouteCurrency(inputPool, currencyIn, 1);
  const outputCurrencyObject = getRouteCurrency(outputPool, outputCurrency, route.length);

  // Determine if WRAP_ETH or UNWRAP_WETH is needed for WETH-denominated pools
  let wrapInput = false;
  let unwrapOutput = false;

  if (useNativeETH) {
    const wethAddress = instance.contracts.weth.toLowerCase();
    const normalizedInputCurrency = currencyIn.toLowerCase();
    const normalizedOutputCurrency = outputCurrency.toLowerCase();

    if (normalizedInputCurrency === wethAddress) {
      wrapInput = true;
    } else if (normalizedOutputCurrency === wethAddress) {
      unwrapOutput = true;
    }
  }

  // Use custom actions if provided, otherwise use default SWAP_EXACT_IN.
  if (customActions && customActions.length > 0) {
    // Add custom actions to the planner
    for (const customAction of customActions) {
      v4Planner.addAction(customAction.action, customAction.parameters);
    }
  } else {
    v4Planner.addAction(Actions.SWAP_EXACT_IN, [
      {
        currencyIn,
        path,
        amountIn: amountIn.toString(),
        amountOutMinimum: amountOutMinimum.toString(),
      },
    ]);
    v4Planner.addSettle(inputCurrencyObject, !wrapInput);
    v4Planner.addTake(outputCurrencyObject, unwrapOutput ? ROUTER_AS_RECIPIENT : recipient);
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

function getRouteCurrency(pool: Pool, address: Address, hopIndex: number) {
  if (pool.poolKey.currency0.toLowerCase() === address.toLowerCase()) {
    return pool.currency0;
  }

  if (pool.poolKey.currency1.toLowerCase() === address.toLowerCase()) {
    return pool.currency1;
  }

  throw new Error(`Invalid swap route: hop ${hopIndex} does not include currency ${address.toLowerCase()}.`);
}
