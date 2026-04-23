import type { BatchPermitOptions, Pool } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

import { CommandType, ROUTER_AS_RECIPIENT, RoutePlanner } from "@uniswap/universal-router-sdk";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { utility } from "hookmate/abi";
import { encodeFunctionData, isHex, zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

import { hasExactOutputAmount, resolveSwapCurrencyMeta, routeWithPoolsToSwapRoute } from "@/internal/swap";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import { resolveSwapRouteExactInput, resolveSwapRouteExactOutput, type SwapRouteWithPools } from "@/utils/swapRoute";

/**
 * Parameters for building a v4 swap
 */
interface BuildSwapCallDataCommonArgs {
  /** Ordered list of pools to route through. A single-hop swap is a route with one entry. */
  route: SwapRouteWithPools;
  recipient: Address;
  /** Deadline duration in seconds from now. Defaults to the SDK instance's `defaultDeadline`. */
  deadlineDuration?: number;
  /** Optional Permit2 batch signature for token approval */
  permit2Signature?: BatchPermitOptions;
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

type ExactInputSwapPlan = {
  tradeType: "exactInput";
  amountIn: bigint;
  minAmountOut: bigint;
  inputAmountForWrap: bigint;
  unwrapAmountMinimum: bigint;
};

type ExactOutputSwapPlan = {
  tradeType: "exactOutput";
  amountOut: bigint;
  maxAmountIn: bigint;
  inputAmountForWrap: bigint;
  unwrapAmountMinimum: bigint;
};

type SwapPlan = ExactInputSwapPlan | ExactOutputSwapPlan;

/**
 * Builds calldata for a Uniswap v4 swap.
 */
export async function buildSwapCallData(params: BuildSwapCallDataArgs, instance: UniswapSDKInstance): Promise<Hex> {
  const { route, permit2Signature, recipient, deadlineDuration, useNativeToken } = params;
  const swapPlan = resolveSwapPlan(params);

  const v4Planner = new V4Planner();
  const routePlanner = new RoutePlanner();
  const routeWithPoolKeys = routeWithPoolsToSwapRoute(route);
  const inputPool = route[0].pool;
  const outputHop = route.at(-1);
  if (outputHop === undefined) {
    throw new Error("Swap route must contain at least one hop.");
  }
  const outputPool = outputHop.pool;
  const meta = resolveSwapCurrencyMeta({ ...params, route: routeWithPoolKeys, wethAddress: instance.contracts.weth });

  const inputCurrency = meta.requestedCurrencyIn;
  const outputCurrency = meta.requestedCurrencyOut;

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

  if (swapPlan.tradeType === "exactOutput") {
    const { path } = resolveSwapRouteExactOutput(outputCurrency, routeWithPoolKeys);
    v4Planner.addAction(Actions.SWAP_EXACT_OUT, [
      {
        currencyOut: outputCurrency,
        path,
        amountOut: swapPlan.amountOut.toString(),
        amountInMaximum: swapPlan.maxAmountIn.toString(),
      },
    ]);
  } else {
    const { path } = resolveSwapRouteExactInput(inputCurrency, routeWithPoolKeys);
    v4Planner.addAction(Actions.SWAP_EXACT_IN, [
      {
        currencyIn: inputCurrency,
        path,
        amountIn: swapPlan.amountIn.toString(),
        amountOutMinimum: swapPlan.minAmountOut.toString(),
      },
    ]);
  }

  v4Planner.addSettle(inputCurrencyObject, !wrapInput);
  v4Planner.addTake(outputCurrencyObject, unwrapOutput ? ROUTER_AS_RECIPIENT : recipient);

  const deadline = await getDefaultDeadline(instance, deadlineDuration);
  const encodedActions = v4Planner.finalize();
  const finalInputs: Hex[] = [];

  if (permit2Signature) {
    routePlanner.addCommand(CommandType.PERMIT2_PERMIT_BATCH, [
      permit2Signature.permitBatch,
      permit2Signature.signature,
    ]);
    finalInputs.push(getLastPlannerInput(routePlanner));
  }

  if (wrapInput) {
    routePlanner.addCommand(CommandType.WRAP_ETH, [ROUTER_AS_RECIPIENT, swapPlan.inputAmountForWrap.toString()]);
    finalInputs.push(getLastPlannerInput(routePlanner));
  }

  routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions]);
  finalInputs.push(getLastPlannerInput(routePlanner));

  if (unwrapOutput) {
    routePlanner.addCommand(CommandType.UNWRAP_WETH, [recipient, swapPlan.unwrapAmountMinimum.toString()]);
    finalInputs.push(getLastPlannerInput(routePlanner));
  }

  if (swapPlan.tradeType === "exactOutput" && wrapInput) {
    routePlanner.addCommand(CommandType.UNWRAP_WETH, [recipient, "0"]);
    finalInputs.push(getLastPlannerInput(routePlanner));
  }

  if (swapPlan.tradeType === "exactOutput" && inputCurrency.toLowerCase() === zeroAddress.toLowerCase()) {
    routePlanner.addCommand(CommandType.SWEEP, [zeroAddress, recipient, "0"]);
    finalInputs.push(getLastPlannerInput(routePlanner));
  }

  return encodeFunctionData({
    abi: utility.UniversalRouterArtifact.abi,
    functionName: "execute",
    args: [getPlannerCommands(routePlanner), finalInputs, deadline],
  });
}

function resolveSwapPlan(params: BuildSwapCallDataArgs): SwapPlan {
  if (hasExactOutputAmount(params.exactOutput)) {
    const { amount } = params.exactOutput;
    const { maxAmountIn } = params;

    if (amount <= 0n) {
      throw new Error(`Invalid exactOutput.amount: ${amount}. Must be a positive value.`);
    }

    if (maxAmountIn === undefined) {
      throw new Error("Missing maxAmountIn.");
    }

    if (maxAmountIn <= 0n) {
      throw new Error(`Invalid maxAmountIn: ${maxAmountIn}. Must be a positive value.`);
    }

    return {
      tradeType: "exactOutput",
      amountOut: amount,
      maxAmountIn,
      inputAmountForWrap: maxAmountIn,
      unwrapAmountMinimum: amount,
    };
  }

  const { exactInput, minAmountOut } = params;
  if (exactInput === undefined) {
    throw new Error("Missing exactInput parameters.");
  }

  if (exactInput.amount <= 0n) {
    throw new Error(`Invalid exactInput.amount: ${exactInput.amount}. Must be a positive value.`);
  }

  if (minAmountOut === undefined) {
    throw new Error("Missing minAmountOut.");
  }

  if (minAmountOut < 0n) {
    throw new Error(`Invalid minAmountOut: ${minAmountOut}. Must be non-negative.`);
  }

  return {
    tradeType: "exactInput",
    amountIn: exactInput.amount,
    minAmountOut,
    inputAmountForWrap: exactInput.amount,
    unwrapAmountMinimum: minAmountOut,
  };
}

function getLastPlannerInput(routePlanner: RoutePlanner): Hex {
  const input = routePlanner.inputs.at(-1);
  if (input === undefined || !isHex(input)) {
    throw new Error("Missing encoded planner input.");
  }

  return input;
}

function getPlannerCommands(routePlanner: RoutePlanner): Hex {
  if (!isHex(routePlanner.commands)) {
    throw new Error("Invalid encoded route planner commands.");
  }

  return routePlanner.commands;
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
