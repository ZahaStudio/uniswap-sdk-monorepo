import type { Pool, PoolKey } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

export interface SwapRouteHop {
  poolKey: PoolKey;
  hookData?: Hex;
}

export type SwapRoute = readonly [SwapRouteHop, ...SwapRouteHop[]];

export interface SwapRoutePoolHop {
  pool: Pool;
  hookData?: Hex;
}

export type SwapRouteWithPools = readonly [SwapRoutePoolHop, ...SwapRoutePoolHop[]];

export interface RoutePathKey {
  intermediateCurrency: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  hookData: Hex;
}

export interface ResolvedSwapRoute {
  path: [RoutePathKey, ...RoutePathKey[]];
  outputCurrency: Address;
}

export interface ResolvedExactOutputSwapRoute {
  path: [RoutePathKey, ...RoutePathKey[]];
  inputCurrency: Address;
}

export function mapRoute<TRoute extends readonly [unknown, ...unknown[]], TOutput>(
  route: TRoute,
  map: (hop: TRoute[number], index: number) => TOutput,
): [TOutput, ...TOutput[]] {
  const mappedRoute = route.map(map);
  const [firstHop, ...remainingHops] = mappedRoute;

  if (firstHop === undefined) {
    throw new Error("Invalid swap route: route must contain at least one hop.");
  }

  return [firstHop, ...remainingHops];
}

export function resolveSwapRoute(currencyIn: Address, route: SwapRoute): ResolvedSwapRoute {
  return resolveSwapRouteExactInput(currencyIn, route);
}

export function resolveSwapRouteExactInput(currencyIn: Address, route: SwapRoute): ResolvedSwapRoute {
  let currentCurrency = currencyIn.toLowerCase();
  const path = mapRoute(route, ({ poolKey, hookData }, hopIndex) => {
    const currency0 = poolKey.currency0.toLowerCase();
    const currency1 = poolKey.currency1.toLowerCase();

    let intermediateCurrency: Address;
    if (currentCurrency === currency0) {
      intermediateCurrency = poolKey.currency1 as Address;
    } else if (currentCurrency === currency1) {
      intermediateCurrency = poolKey.currency0 as Address;
    } else {
      throw new Error(`Invalid swap route: hop ${hopIndex + 1} does not connect to currency ${currentCurrency}.`);
    }

    currentCurrency = intermediateCurrency.toLowerCase();

    return {
      intermediateCurrency,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
      hookData: hookData ?? "0x",
    };
  });

  return {
    path,
    outputCurrency: path[path.length - 1]!.intermediateCurrency,
  };
}

export function resolveSwapRouteExactOutput(currencyOut: Address, route: SwapRoute): ResolvedExactOutputSwapRoute {
  let currentCurrency = currencyOut.toLowerCase();
  const reversedPath: RoutePathKey[] = [];

  for (let reverseHopIndex = route.length - 1; reverseHopIndex >= 0; reverseHopIndex -= 1) {
    const { poolKey, hookData } = route[reverseHopIndex]!;
    const currency0 = poolKey.currency0.toLowerCase();
    const currency1 = poolKey.currency1.toLowerCase();

    let previousCurrency: Address;
    if (currentCurrency === currency0) {
      previousCurrency = poolKey.currency1 as Address;
    } else if (currentCurrency === currency1) {
      previousCurrency = poolKey.currency0 as Address;
    } else {
      throw new Error(
        `Invalid swap route: reverse hop ${route.length - reverseHopIndex} does not connect to currency ${currentCurrency}.`,
      );
    }

    reversedPath.push({
      intermediateCurrency: previousCurrency,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
      hookData: hookData ?? "0x",
    });

    currentCurrency = previousCurrency.toLowerCase();
  }

  const path = reversedPath.reverse();
  const [firstHop, ...remainingHops] = path;

  if (firstHop === undefined) {
    throw new Error("Invalid swap route: route must contain at least one hop.");
  }

  return {
    path: [firstHop, ...remainingHops],
    inputCurrency: currentCurrency as Address,
  };
}
