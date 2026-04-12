import type { Address } from "viem";

import { zeroAddress } from "viem";

import {
  mapRoute,
  resolveSwapRouteExactInput,
  resolveSwapRouteExactOutput,
  type SwapRoute,
  type SwapRouteWithPools,
} from "@/utils/swapRoute";

export interface SwapCurrencyMeta {
  requestedCurrencyIn: Address;
  requestedCurrencyOut: Address;
  resolvedCurrencyIn: Address;
  resolvedCurrencyOut: Address;
}

interface ExactInputCurrencyArgs {
  route: SwapRoute;
  exactInput: {
    currency: Address;
  };
  exactOutput?: never;
  useNativeToken?: boolean;
  wethAddress: Address;
}

interface ExactOutputCurrencyArgs {
  route: SwapRoute;
  exactOutput: {
    currency: Address;
  };
  exactInput?: never;
  useNativeToken?: boolean;
  wethAddress: Address;
}

export type ResolveSwapCurrencyMetaArgs = ExactInputCurrencyArgs | ExactOutputCurrencyArgs;

function isExactOutputArgs(args: ResolveSwapCurrencyMetaArgs): args is ExactOutputCurrencyArgs {
  return "exactOutput" in args;
}

export function routeWithPoolsToSwapRoute(route: SwapRouteWithPools): SwapRoute {
  return mapRoute(route, ({ pool, hookData }) => ({ poolKey: pool.poolKey, hookData }));
}

export function resolveSwapCurrencyMeta(args: ResolveSwapCurrencyMetaArgs): SwapCurrencyMeta {
  const { route, useNativeToken, wethAddress } = args;
  const firstHopPoolKey = route[0].poolKey;
  const lastHopPoolKey = route[route.length - 1]!.poolKey;
  const firstHopSupportsNativeInput =
    firstHopPoolKey.currency0.toLowerCase() === zeroAddress.toLowerCase() ||
    firstHopPoolKey.currency1.toLowerCase() === zeroAddress.toLowerCase();
  const lastHopSupportsNativeOutput =
    lastHopPoolKey.currency0.toLowerCase() === zeroAddress.toLowerCase() ||
    lastHopPoolKey.currency1.toLowerCase() === zeroAddress.toLowerCase();

  const requestedCurrencyIn = isExactOutputArgs(args)
    ? resolveSwapRouteExactOutput(args.exactOutput.currency, route).inputCurrency
    : args.exactInput.currency;
  const requestedCurrencyOut = isExactOutputArgs(args)
    ? args.exactOutput.currency
    : resolveSwapRouteExactInput(args.exactInput.currency, route).outputCurrency;

  const resolvedCurrencyIn =
    useNativeToken && requestedCurrencyIn.toLowerCase() === wethAddress.toLowerCase() && !firstHopSupportsNativeInput
      ? zeroAddress
      : requestedCurrencyIn;
  const resolvedCurrencyOut =
    useNativeToken && requestedCurrencyOut.toLowerCase() === wethAddress.toLowerCase() && !lastHopSupportsNativeOutput
      ? zeroAddress
      : requestedCurrencyOut;

  return {
    requestedCurrencyIn,
    requestedCurrencyOut,
    resolvedCurrencyIn,
    resolvedCurrencyOut,
  };
}
