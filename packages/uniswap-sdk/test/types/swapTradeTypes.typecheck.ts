import type { Address } from "viem";

import { TradeType } from "@/types/tradeType";
import type { BuildSwapExactInArgs, BuildSwapExactOutArgs } from "@/utils/buildSwapCallData";
import type { SwapExactIn, SwapExactOut } from "@/utils/getQuote";

type Expect<T extends true> = T;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type _SwapExactInTradeType = Expect<Equal<SwapExactIn["tradeType"], typeof TradeType.ExactInput>>;
type _SwapExactInCurrencyIn = Expect<Equal<SwapExactIn["currencyIn"], Address>>;
type _SwapExactInRejectsOutputAmount = Expect<Equal<SwapExactIn["amountOut"], never | undefined>>;

type _SwapExactOutTradeType = Expect<Equal<SwapExactOut["tradeType"], typeof TradeType.ExactOutput>>;
type _SwapExactOutCurrencyOut = Expect<Equal<SwapExactOut["currencyOut"], Address>>;
type _SwapExactOutRejectsInputCurrency = Expect<Equal<SwapExactOut["currencyIn"], never | undefined>>;
type _SwapExactOutRejectsInputAmount = Expect<Equal<SwapExactOut["amountIn"], never | undefined>>;

type _BuildSwapExactInAmountIn = Expect<Equal<BuildSwapExactInArgs["amountIn"], bigint>>;
type _BuildSwapExactInRejectsAmountInMaximum = Expect<Equal<BuildSwapExactInArgs["amountInMaximum"], never | undefined>>;

type _BuildSwapExactOutTradeType = Expect<Equal<BuildSwapExactOutArgs["tradeType"], typeof TradeType.ExactOutput>>;
type _BuildSwapExactOutAmountOut = Expect<Equal<BuildSwapExactOutArgs["amountOut"], bigint>>;
type _BuildSwapExactOutAmountInMaximum = Expect<Equal<BuildSwapExactOutArgs["amountInMaximum"], bigint>>;
type _BuildSwapExactOutRejectsAmountOutMinimum = Expect<
  Equal<BuildSwapExactOutArgs["amountOutMinimum"], never | undefined>
>;
