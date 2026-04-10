import type { PoolKey } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

export interface SwapRouteHopLike {
  poolKey: PoolKey;
  hookData?: Hex;
}

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

export function resolveSwapRoute(
  currencyIn: Address,
  route: readonly [SwapRouteHopLike, ...SwapRouteHopLike[]],
): ResolvedSwapRoute {
  let currentCurrency = currencyIn.toLowerCase();
  const path = route.map(({ poolKey, hookData }, hopIndex) => {
    const currency0 = poolKey.currency0.toLowerCase();
    const currency1 = poolKey.currency1.toLowerCase();

    let intermediateCurrency: Address;
    if (currentCurrency === currency0) {
      intermediateCurrency = poolKey.currency1 as Address;
    } else if (currentCurrency === currency1) {
      intermediateCurrency = poolKey.currency0 as Address;
    } else {
      throw new Error(
        `Invalid swap route: hop ${hopIndex + 1} does not connect to currency ${currentCurrency}.`,
      );
    }

    currentCurrency = intermediateCurrency.toLowerCase();

    return {
      intermediateCurrency,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks as Address,
      hookData: hookData ?? "0x",
    };
  }) as [RoutePathKey, ...RoutePathKey[]];

  return {
    path,
    outputCurrency: path[path.length - 1]!.intermediateCurrency,
  };
}
