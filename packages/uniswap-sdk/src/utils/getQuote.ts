import type { Address } from "viem";

import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/core/sdk";
import type { ExactInputTradeType, ExactOutputTradeType } from "@/types/tradeType";
import { TradeType } from "@/types/tradeType";

import {
  resolveSwapRouteExactInput,
  resolveSwapRouteExactOutput,
  type SwapRoute,
} from "@/utils/swapRoute";

export type SupportedTradeType = ExactInputTradeType | ExactOutputTradeType;

/**
 * Exact-input swap quote parameters for a single route.
 *
 *
 * @example
 * ```typescript
 * const swapParams: SwapExactIn = {
 *   currencyIn: "0x...",
 *   route: [
 *     {
 *       poolKey: {
 *         currency0: "0x...",
 *         currency1: "0x...",
 *         fee: 500,
 *         tickSpacing: 10,
 *         hooks: "0x0000000000000000000000000000000000000000"
 *       },
 *     },
 *   ],
 *   amountIn: "1000000"
 * };
 * ```
 */
export interface SwapExactIn {
  /**
   * Trade type for the quote.
   */
  tradeType: ExactInputTradeType;

  /**
   * Input currency for the first hop in the route.
   */
  currencyIn: Address;

  /**
   * Ordered list of pools to route through. A single-hop swap is a route with one entry.
   */
  route: SwapRoute;

  /**
   * The amount of tokens being swapped, as string (numberish).
   * Accepts bigint.toString(), number, etc.
   */
  amountIn: bigint | string;
  currencyOut?: never;
  amountOut?: never;
}

/**
 * Exact-output swap quote parameters for a single route.
 */
export interface SwapExactOut {
  /**
   * Trade type for the quote.
   */
  tradeType: ExactOutputTradeType;

  /**
   * Output currency for the final hop in the route.
   */
  currencyOut: Address;

  /**
   * Ordered list of pools to route through. A single-hop swap is a route with one entry.
   */
  route: SwapRoute;

  /**
   * The amount of output tokens requested, as string (numberish).
   * Accepts bigint.toString(), number, etc.
   */
  amountOut: bigint | string;
  currencyIn?: never;
  amountIn?: never;
}

export type SwapQuoteParams = SwapExactIn | SwapExactOut;

interface QuoteResponseBase<TTradeType extends SupportedTradeType> {
  tradeType: TTradeType;
  amountIn: bigint;
  amountOut: bigint;
  timestamp: number;
}

export type ExactInputQuoteResponse = QuoteResponseBase<ExactInputTradeType>;
export type ExactOutputQuoteResponse = QuoteResponseBase<ExactOutputTradeType>;

/**
 * Response structure for a successful quote simulation.
 *
 * @example
 * ```typescript
 * const response: QuoteResponse = {
 *   amountOut: 950000n,
 *   timestamp: 1703123456789
 * };
 * ```
 */
export type QuoteResponse<TTradeType extends SupportedTradeType = SupportedTradeType> = TTradeType extends
  ExactInputTradeType
  ? ExactInputQuoteResponse
  : ExactOutputQuoteResponse;

function isExactOutputQuote(params: SwapQuoteParams): params is SwapExactOut {
  return params.tradeType === TradeType.ExactOutput;
}

/**
 * Fetches a quote for a token swap using the V4 Quoter contract.
 * This function uses the provided pool instance to simulate the quote.
 *
 * @param params - The parameters required for the quote, including pool and amount.
 * @param instance - UniswapSDKInstance for contract interaction
 * @returns A Promise that resolves to the quote result, including the amount out and fetch timestamp.
 * @throws Will throw an error if:
 * - Simulation fails (e.g., insufficient liquidity, invalid parameters)
 * - Contract call reverts
 */
export async function getQuote(
  params: SwapExactIn,
  instance: UniswapSDKInstance,
): Promise<QuoteResponse<ExactInputTradeType>>;
export async function getQuote(
  params: SwapExactOut,
  instance: UniswapSDKInstance,
): Promise<QuoteResponse<ExactOutputTradeType>>;
export async function getQuote(params: SwapQuoteParams, instance: UniswapSDKInstance): Promise<QuoteResponse> {
  const { client, contracts } = instance;
  const { quoter } = contracts;

  try {
    if (isExactOutputQuote(params)) {
      const amountOut = BigInt(params.amountOut);
      const { path } = resolveSwapRouteExactOutput(params.currencyOut, params.route);

      const quoteParams = {
        exactCurrency: params.currencyOut,
        path,
        exactAmount: amountOut,
      };

      const simulation = await client.simulateContract({
        address: quoter,
        abi: v4.QuoterArtifact.abi,
        functionName: "quoteExactOutput",
        args: [quoteParams],
      });

      const [amountIn] = simulation.result;

      return {
        tradeType: TradeType.ExactOutput,
        amountIn,
        amountOut,
        timestamp: Date.now(),
      };
    }

    const amountIn = BigInt(params.amountIn);
    const { path } = resolveSwapRouteExactInput(params.currencyIn, params.route);

    const quoteParams = {
      exactCurrency: params.currencyIn,
      path,
      exactAmount: amountIn,
    };

    const simulation = await client.simulateContract({
      address: quoter,
      abi: v4.QuoterArtifact.abi,
      functionName: "quoteExactInput",
      args: [quoteParams],
    });

    const [amountOut] = simulation.result;

    return {
      tradeType: TradeType.ExactInput,
      amountIn,
      amountOut,
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch quote: ${error instanceof Error ? error.message : String(error)}`);
  }
}
