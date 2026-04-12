import type { BatchPermitOptions, Pool } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

import { CommandType, ROUTER_AS_RECIPIENT, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import { encodeFunctionData, zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

import { resolveSwapCurrencyMeta, routeWithPoolsToSwapRoute } from "@/internal/swap";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { resolveSwapRouteExactInput, resolveSwapRouteExactOutput, type SwapRouteWithPools } from "@/utils/swapRoute";

/**
 * Parameters for building a V4 swap
 */
interface BuildSwapCallDataCommonArgs {
  /** Ordered list of pools to route through. A single-hop swap is a route with one entry. */
  route: SwapRouteWithPools;
  recipient: Address;
  /** Deadline duration in seconds from now. Defaults to the SDK instance's `defaultDeadline`. */
  deadlineDuration?: number;
  /** Optional Permit2 batch signature for token approval */
  permit2Signature?: BatchPermitOptions;
  /** Custom actions to override default swap behavior. */
  customActions?: {
    action: Actions;
    parameters: unknown[];
  }[];
  /** When true, wraps/unwraps the native token for WETH-denominated pools. */
  useNativeToken?: boolean;
}

interface BuildSwapCallDataExactInputArgs extends BuildSwapCallDataCommonArgs {
  exactInput: {
    /** Input currency for the first hop in the route. */
    currency: Address;
    amount: bigint;
  };
  minAmountOut: bigint;
  exactOutput?: never;
  maxAmountIn?: never;
}

interface BuildSwapCallDataExactOutputArgs extends BuildSwapCallDataCommonArgs {
  exactOutput: {
    /** Output currency for the final hop in the route. */
    currency: Address;
    amount: bigint;
  };
  maxAmountIn: bigint;
  exactInput?: never;
  minAmountOut?: never;
}

export type BuildSwapCallDataArgs = BuildSwapCallDataExactInputArgs | BuildSwapCallDataExactOutputArgs;

function isExactOutputSwap(params: BuildSwapCallDataArgs): params is BuildSwapCallDataExactOutputArgs {
  return "exactOutput" in params;
}

/**
 * Builds calldata for a Uniswap V4 swap.
 */
export async function buildSwapCallData(params: BuildSwapCallDataArgs, instance: UniswapSDKInstance): Promise<Hex> {
  const { route, permit2Signature, recipient, customActions, deadlineDuration, useNativeToken } = params;
  const exactOutput = isExactOutputSwap(params);

  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();
  const routeWithPoolKeys = routeWithPoolsToSwapRoute(route);
  const inputPool = route[0].pool;
  const outputPool = route[route.length - 1]!.pool;
  const meta = resolveSwapCurrencyMeta({ ...params, route: routeWithPoolKeys, wethAddress: instance.contracts.weth });

  const inputCurrency = meta.requestedCurrencyIn;
  const outputCurrency = meta.requestedCurrencyOut;
  const inputAmountForWrap = exactOutput ? params.maxAmountIn : params.exactInput.amount;

  if (exactOutput) {
    if (params.exactOutput.amount <= 0n) {
      throw new Error(`Invalid exactOutput.amount: ${params.exactOutput.amount}. Must be a positive value.`);
    }

    if (params.maxAmountIn <= 0n) {
      throw new Error(`Invalid maxAmountIn: ${params.maxAmountIn}. Must be a positive value.`);
    }
  } else {
    if (params.exactInput.amount <= 0n) {
      throw new Error(`Invalid exactInput.amount: ${params.exactInput.amount}. Must be a positive value.`);
    }

    if (params.minAmountOut < 0n) {
      throw new Error(`Invalid minAmountOut: ${params.minAmountOut}. Must be non-negative.`);
    }
  }

  const inputCurrencyObject = getCurrencyFromPool(inputPool, inputCurrency);
  const outputCurrencyObject = getCurrencyFromPool(outputPool, outputCurrency);

  let wrapInput = false;
  let unwrapOutput = false;

  if (useNativeToken) {
    const wethAddress = instance.contracts.weth.toLowerCase();

    if (inputCurrency.toLowerCase() === wethAddress) {
      wrapInput = true;
    }

    if (outputCurrency.toLowerCase() === wethAddress) {
      unwrapOutput = true;
    }
  }

  if (customActions && customActions.length > 0) {
    for (const customAction of customActions) {
      v4Planner.addAction(customAction.action, customAction.parameters);
    }
  } else {
    if (exactOutput) {
      const { path } = resolveSwapRouteExactOutput(outputCurrency, routeWithPoolKeys);
      v4Planner.addAction(Actions.SWAP_EXACT_OUT, [
        {
          currencyOut: outputCurrency,
          path,
          amountOut: params.exactOutput.amount.toString(),
          amountInMaximum: params.maxAmountIn.toString(),
        },
      ]);
    } else {
      const { path } = resolveSwapRouteExactInput(inputCurrency, routeWithPoolKeys);
      v4Planner.addAction(Actions.SWAP_EXACT_IN, [
        {
          currencyIn: inputCurrency,
          path,
          amountIn: params.exactInput.amount.toString(),
          amountOutMinimum: params.minAmountOut.toString(),
        },
      ]);
    }

    v4Planner.addSettle(inputCurrencyObject, !wrapInput);
    v4Planner.addTake(outputCurrencyObject, unwrapOutput ? ROUTER_AS_RECIPIENT : recipient);
  }

  const deadline = await getDefaultDeadline(instance, deadlineDuration);
  const encodedActions = v4Planner.finalize();
  const finalInputs: Hex[] = [];

  if (permit2Signature) {
    routePlanner.addCommand(CommandType.PERMIT2_PERMIT_BATCH, [
      permit2Signature.permitBatch,
      permit2Signature.signature,
    ]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  if (wrapInput) {
    routePlanner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, inputAmountForWrap.toString()]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.actions, v4Planner.params]);
  finalInputs.push(encodedActions as Hex);

  if (unwrapOutput) {
    routePlanner.addCommand(CommandType.UNWRAP_WETH, [
      recipient,
      exactOutput ? params.exactOutput.amount.toString() : params.minAmountOut.toString(),
    ]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  if (exactOutput && wrapInput && !unwrapOutput) {
    routePlanner.addCommand(CommandType.UNWRAP_WETH, [recipient, "0"]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  if (exactOutput && inputCurrency.toLowerCase() === zeroAddress.toLowerCase()) {
    routePlanner.addCommand(CommandType.SWEEP, [zeroAddress, recipient, "0"]);
    finalInputs.push(routePlanner.inputs.at(-1) as Hex);
  }

  return encodeFunctionData({
    abi: utility.UniversalRouterArtifact.abi,
    functionName: "execute",
    args: [routePlanner.commands as Hex, finalInputs, deadline],
  });
}

function getCurrencyFromPool(pool: Pool, address: Address) {
  if (pool.poolKey.currency0.toLowerCase() === address.toLowerCase()) {
    return pool.currency0;
  }

  if (pool.poolKey.currency1.toLowerCase() === address.toLowerCase()) {
    return pool.currency1;
  }

  throw new Error(`Invalid swap route: first hop does not include currency ${address.toLowerCase()}.`);
}
