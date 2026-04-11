import type { Address } from "viem";

import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/core/sdk";

import { resolveSwapRoute, type SwapRoute } from "@/utils/swapRoute";

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
}

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
export interface QuoteResponse {
  /**
   * The estimated amount of tokens out for the given input amount.
   * @returns The output amount as a bigint
   */
  amountOut: bigint;

  /**
   * The timestamp when the quote was fetched.
   * @returns Unix timestamp in milliseconds
   */
  timestamp: number;
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
export async function getQuote(params: SwapExactIn, instance: UniswapSDKInstance): Promise<QuoteResponse> {
  const { client, contracts } = instance;
  const { quoter } = contracts;

  try {
    const { path } = resolveSwapRoute(params.currencyIn, params.route);

    const quoteParams = {
      exactCurrency: params.currencyIn,
      path,
      exactAmount: BigInt(params.amountIn),
    };

    // Simulate the quote to estimate the amount out
    const simulation = await client.simulateContract({
      address: quoter,
      abi: v4.QuoterArtifact.abi,
      functionName: "quoteExactInput",
      args: [quoteParams],
    });

    // Extract the results
    const [amountOut] = simulation.result;

    return {
      amountOut,
      timestamp: Date.now(),
    };
  } catch (error) {
    throw new Error(`Failed to fetch quote: ${error instanceof Error ? error.message : String(error)}`);
  }
}
