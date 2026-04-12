import type { Address } from "viem";

import type { BuildSwapCallDataArgs } from "@/utils/buildSwapCallData";
import type { QuoteResponse, SwapQuoteParams } from "@/utils/getQuote";
import type { SwapRoute, SwapRouteWithPools } from "@/utils/swapRoute";

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

declare const address: Address;
declare const route: SwapRoute;
declare const routeWithPools: SwapRouteWithPools;

const exactInputQuoteParams: SwapQuoteParams = {
  route,
  exactInput: {
    currency: address,
    amount: 1n,
  },
};

const exactOutputQuoteParams: SwapQuoteParams = {
  route,
  exactOutput: {
    currency: address,
    amount: 1n,
  },
};

const exactInputCallDataArgs: BuildSwapCallDataArgs = {
  route: routeWithPools,
  recipient: address,
  exactInput: {
    currency: address,
    amount: 1n,
  },
  minAmountOut: 0n,
};

const exactOutputCallDataArgs: BuildSwapCallDataArgs = {
  route: routeWithPools,
  recipient: address,
  exactOutput: {
    currency: address,
    amount: 1n,
  },
  maxAmountIn: 2n,
};

type _QuoteParamsRoute = Expect<Equal<(typeof exactInputQuoteParams)["route"], SwapRoute>>;
type _QuoteParamsExactInputCurrency = Expect<Equal<(typeof exactInputQuoteParams)["exactInput"]["currency"], Address>>;
type _QuoteParamsExactOutputAmount = Expect<
  Equal<(typeof exactOutputQuoteParams)["exactOutput"]["amount"], bigint | string>
>;

type _CallDataArgsExactInputAmount = Expect<Equal<(typeof exactInputCallDataArgs)["exactInput"]["amount"], bigint>>;
type _CallDataArgsHasMinAmountOut = Expect<Equal<(typeof exactInputCallDataArgs)["minAmountOut"], bigint>>;
type _CallDataArgsHasMaxAmountIn = Expect<Equal<(typeof exactOutputCallDataArgs)["maxAmountIn"], bigint>>;

type _QuoteResponseHasMeta = Expect<Equal<HasKey<QuoteResponse, "meta">, true>>;
type _QuoteResponseHasNoTradeType = Expect<Equal<HasKey<QuoteResponse, "tradeType">, false>>;
