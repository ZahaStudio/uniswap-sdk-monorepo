import { TradeType as UniswapTradeType } from "@uniswap/sdk-core";

/**
 * Public swap trade type discriminant.
 *
 * Values intentionally match Uniswap SDK-Core's TradeType enum so they can be
 * passed through to upstream utilities without conversion.
 */
export const TradeType = {
  ExactInput: UniswapTradeType.EXACT_INPUT,
  ExactOutput: UniswapTradeType.EXACT_OUTPUT,
} as const;

export type TradeType = (typeof TradeType)[keyof typeof TradeType];
export type ExactInputTradeType = typeof TradeType.ExactInput;
export type ExactOutputTradeType = typeof TradeType.ExactOutput;
