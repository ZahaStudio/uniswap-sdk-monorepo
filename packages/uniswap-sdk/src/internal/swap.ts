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

export function hasExactOutputCurrency(exactOutput: unknown): exactOutput is { currency: Address } {
  return (
    exactOutput !== undefined && exactOutput !== null && typeof exactOutput === "object" && "currency" in exactOutput
  );
}

export function hasExactOutputAmount(exactOutput: unknown): exactOutput is { currency: Address; amount: unknown } {
  return (
    exactOutput !== undefined &&
    exactOutput !== null &&
    typeof exactOutput === "object" &&
    "currency" in exactOutput &&
    "amount" in exactOutput
  );
}

export function hasExactInputAmount(exactInput: unknown): exactInput is { currency: Address; amount: unknown } {
  return (
    exactInput !== undefined &&
    exactInput !== null &&
    typeof exactInput === "object" &&
    "currency" in exactInput &&
    "amount" in exactInput
  );
}

export function routeWithPoolsToSwapRoute(route: SwapRouteWithPools): SwapRoute {
  return mapRoute(route, ({ pool, hookData }) => ({ poolKey: pool.poolKey, hookData }));
}

export function resolveSwapCurrencyMeta(args: ResolveSwapCurrencyMetaArgs): SwapCurrencyMeta {
  const { route, useNativeToken, wethAddress } = args;
  const nativeAddress = zeroAddress;
  const normalizedWethAddress = wethAddress.toLowerCase();
  const firstHopPoolKey = route[0].poolKey;
  const lastHopPoolKey = route[route.length - 1]!.poolKey;
  const firstHopSupportsNativeInput =
    firstHopPoolKey.currency0.toLowerCase() === nativeAddress ||
    firstHopPoolKey.currency1.toLowerCase() === nativeAddress;
  const lastHopSupportsNativeOutput =
    lastHopPoolKey.currency0.toLowerCase() === nativeAddress ||
    lastHopPoolKey.currency1.toLowerCase() === nativeAddress;

  const exactOutput = args.exactOutput;

  let requestedCurrencyIn: Address;
  let requestedCurrencyOut: Address;

  if (hasExactOutputCurrency(exactOutput)) {
    requestedCurrencyIn = resolveSwapRouteExactOutput(exactOutput.currency, route).inputCurrency;
    requestedCurrencyOut = exactOutput.currency;
  } else {
    const exactInput = args.exactInput;
    if (exactInput === undefined) {
      throw new Error("Expected exactInput when exactOutput is not provided.");
    }

    requestedCurrencyIn = exactInput.currency;
    requestedCurrencyOut = resolveSwapRouteExactInput(exactInput.currency, route).outputCurrency;
  }

  const resolvedCurrencyIn =
    useNativeToken && requestedCurrencyIn.toLowerCase() === normalizedWethAddress && !firstHopSupportsNativeInput
      ? zeroAddress
      : requestedCurrencyIn;
  const resolvedCurrencyOut =
    useNativeToken && requestedCurrencyOut.toLowerCase() === normalizedWethAddress && !lastHopSupportsNativeOutput
      ? zeroAddress
      : requestedCurrencyOut;

  return {
    requestedCurrencyIn,
    requestedCurrencyOut,
    resolvedCurrencyIn,
    resolvedCurrencyOut,
  };
}
