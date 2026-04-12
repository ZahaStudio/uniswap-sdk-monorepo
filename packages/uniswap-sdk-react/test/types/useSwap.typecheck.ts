import type { Address } from "viem";

import { TradeType, type SwapRoute } from "@zahastudio/uniswap-sdk";

import { useSwap, type UseSwapExactInParams, type UseSwapExactOutParams } from "@/hooks/useSwap";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

declare const address: Address;
declare const route: SwapRoute;

const exactInputSwap = useSwap({
  tradeType: TradeType.ExactInput,
  currencyIn: address,
  route,
  amountIn: 1n,
});

const exactOutputSwap = useSwap({
  tradeType: TradeType.ExactOutput,
  currencyOut: address,
  route,
  amountOut: 1n,
});

type ExactInputQuote = NonNullable<(typeof exactInputSwap.steps.quote.data)>;
type ExactOutputQuote = NonNullable<(typeof exactOutputSwap.steps.quote.data)>;

type _UseSwapExactInTradeType = Expect<Equal<UseSwapExactInParams["tradeType"], typeof TradeType.ExactInput>>;
type _UseSwapExactInRejectsAmountOut = Expect<Equal<UseSwapExactInParams["amountOut"], never | undefined>>;

type _UseSwapExactOutTradeType = Expect<Equal<UseSwapExactOutParams["tradeType"], typeof TradeType.ExactOutput>>;
type _UseSwapExactOutRejectsCurrencyIn = Expect<Equal<UseSwapExactOutParams["currencyIn"], never | undefined>>;
type _UseSwapExactOutRejectsAmountIn = Expect<Equal<UseSwapExactOutParams["amountIn"], never | undefined>>;

type _ExactInputQuoteHasMin = Expect<Equal<ExactInputQuote["minAmountOut"], bigint>>;
type _ExactInputQuoteHasNoMax = Expect<Equal<HasKey<ExactInputQuote, "maxAmountIn">, false>>;

type _ExactOutputQuoteHasMax = Expect<Equal<ExactOutputQuote["maxAmountIn"], bigint>>;
type _ExactOutputQuoteHasNoMin = Expect<Equal<HasKey<ExactOutputQuote, "minAmountOut">, false>>;
