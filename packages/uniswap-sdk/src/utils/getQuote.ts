import type { Address } from "viem";

import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/core/sdk";

import { resolveSwapCurrencyMeta } from "@/internal/swap";
import { resolveSwapRouteExactInput, resolveSwapRouteExactOutput, type SwapRoute } from "@/utils/swapRoute";

/**
 * Effective swap currencies after applying native ETH wrapping or unwrapping.
 */
export interface SwapMeta {
  resolvedCurrencyIn: Address;
  resolvedCurrencyOut: Address;
}

interface SwapQuoteExactInputParams {
  /** Ordered list of pools to route through. A single-hop swap is a route with one entry. */
  route: SwapRoute;
  /** Exact-input swap configuration. */
  exactInput: {
    /** Input currency for the first hop in the route. */
    currency: Address;
    /** The amount of input tokens, as string (numberish). Accepts bigint.toString(), number, etc. */
    amount: bigint | string;
  };
  exactOutput?: never;
  /** When true, resolves WETH-denominated route edges as the native token. */
  useNativeToken?: boolean;
}

interface SwapQuoteExactOutputParams {
  /** Ordered list of pools to route through. A single-hop swap is a route with one entry. */
  route: SwapRoute;
  /** Exact-output swap configuration. */
  exactOutput: {
    /** Output currency for the final hop in the route. */
    currency: Address;
    /** The amount of output tokens requested, as string (numberish). Accepts bigint.toString(), number, etc. */
    amount: bigint | string;
  };
  exactInput?: never;
  /** When true, resolves WETH-denominated route edges as the native token. */
  useNativeToken?: boolean;
}

export type SwapQuoteParams = SwapQuoteExactInputParams | SwapQuoteExactOutputParams;

/**
 * Response structure for a successful quote simulation.
 */
export interface QuoteResponse {
  amountIn: bigint;
  amountOut: bigint;
  timestamp: number;
  meta: SwapMeta;
}

function isExactOutputQuote(params: SwapQuoteParams): params is SwapQuoteExactOutputParams {
  return "exactOutput" in params;
}

/**
 * Fetches a quote for a token swap using the V4 Quoter contract.
 * This function uses the provided pool instance to simulate the quote.
 *
 * @param params - The parameters required for the quote, including route and exact amount.
 * @param instance - UniswapSDKInstance for contract interaction
 * @returns A Promise that resolves to the quote result, including amounts, meta, and fetch timestamp.
 */
export async function getQuote(params: SwapQuoteParams, instance: UniswapSDKInstance): Promise<QuoteResponse> {
  const { client, contracts } = instance;
  const { quoter, weth } = contracts;
  const meta = resolveSwapCurrencyMeta({ ...params, wethAddress: weth });

  try {
    if (isExactOutputQuote(params)) {
      const amountOut = BigInt(params.exactOutput.amount);
      const { path } = resolveSwapRouteExactOutput(meta.requestedCurrencyOut, params.route);

      const simulation = await client.simulateContract({
        address: quoter,
        abi: v4.QuoterArtifact.abi,
        functionName: "quoteExactOutput",
        args: [
          {
            exactCurrency: meta.requestedCurrencyOut,
            path,
            exactAmount: amountOut,
          },
        ],
      });

      const [amountIn] = simulation.result;

      return {
        amountIn,
        amountOut,
        timestamp: Date.now(),
        meta: {
          resolvedCurrencyIn: meta.resolvedCurrencyIn,
          resolvedCurrencyOut: meta.resolvedCurrencyOut,
        },
      };
    }

    const amountIn = BigInt(params.exactInput.amount);
    const { path } = resolveSwapRouteExactInput(meta.requestedCurrencyIn, params.route);

    const simulation = await client.simulateContract({
      address: quoter,
      abi: v4.QuoterArtifact.abi,
      functionName: "quoteExactInput",
      args: [
        {
          exactCurrency: meta.requestedCurrencyIn,
          path,
          exactAmount: amountIn,
        },
      ],
    });

    const [amountOut] = simulation.result;

    return {
      amountIn,
      amountOut,
      timestamp: Date.now(),
      meta: {
        resolvedCurrencyIn: meta.resolvedCurrencyIn,
        resolvedCurrencyOut: meta.resolvedCurrencyOut,
      },
    };
  } catch (error) {
    throw new Error(`Failed to fetch quote: ${error instanceof Error ? error.message : String(error)}`);
  }
}
