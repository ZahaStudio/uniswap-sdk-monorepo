import type { SwapRoute } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";

import { useSwap, type UseSwapParams } from "@/hooks/useSwap";

type Expect<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type HasKey<T, K extends PropertyKey> = K extends keyof T ? true : false;

declare const address: Address;
declare const route: SwapRoute;

const exactInputParams: UseSwapParams = {
  route,
  exactInput: {
    currency: address,
    amount: 1n,
  },
};

const exactOutputParams: UseSwapParams = {
  route,
  exactOutput: {
    currency: address,
    amount: 1n,
  },
};

const exactInputSwap = useSwap(exactInputParams);
const exactOutputSwap = useSwap(exactOutputParams);

type ExactInputQuote = NonNullable<typeof exactInputSwap.steps.quote.data>;
type ExactOutputQuote = NonNullable<typeof exactOutputSwap.steps.quote.data>;

type _UseSwapParamsRoute = Expect<Equal<UseSwapParams["route"], SwapRoute>>;
type _UseSwapExactInputAmount = Expect<Equal<NonNullable<typeof exactInputParams.exactInput>["amount"], bigint>>;
type _UseSwapExactOutputCurrency = Expect<
  Equal<NonNullable<typeof exactOutputParams.exactOutput>["currency"], Address>
>;

type _UseSwapHasMeta = Expect<Equal<HasKey<typeof exactInputSwap, "meta">, true>>;
type _UseSwapMetaResolvedIn = Expect<Equal<(typeof exactInputSwap.meta)["resolvedCurrencyIn"], Address>>;

type _ExactInputQuoteHasMin = Expect<Equal<ExactInputQuote["minAmountOut"], bigint>>;
type _ExactInputQuoteHasNoMax = Expect<Equal<HasKey<ExactInputQuote, "maxAmountIn">, false>>;

type _ExactOutputQuoteHasMax = Expect<Equal<ExactOutputQuote["maxAmountIn"], bigint>>;
type _ExactOutputQuoteHasNoMin = Expect<Equal<HasKey<ExactOutputQuote, "minAmountOut">, false>>;
