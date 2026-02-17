import type { SwapExactInSingle as UniswapSwapExactInSingle } from "@uniswap/v4-sdk";
import { v4 } from "hookmate/abi";
import type { Address, Hex } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";

/**
 * Extended SwapExactInSingle type that ensures alignment with Uniswap V4 SDK
 * while providing additional flexibility for our use case.
 *
 *
 * @example
 * ```typescript
 * const swapParams: SwapExactInSingle = {
 *   poolKey: {
 *     currency0: "0x...",
 *     currency1: "0x...",
 *     fee: 500,
 *     tickSpacing: 10,
 *     hooks: "0x0000000000000000000000000000000000000000"
 *   },
 *   zeroForOne: true,
 *   amountIn: "1000000"
 * };
 * ```
 */
export interface SwapExactInSingle {
  /**
   * Pool key with currency addresses, fee, tick spacing, and hooks.
   */
  poolKey: UniswapSwapExactInSingle["poolKey"];

  /**
   * Direction of the swap. True if swapping from currency0 to currency1.
   */
  zeroForOne: UniswapSwapExactInSingle["zeroForOne"];

  /**
   * The amount of tokens being swapped, as string (numberish).
   * Accepts bigint.toString(), number, etc.
   */
  amountIn: UniswapSwapExactInSingle["amountIn"];

  /**
   * Minimum amount out for slippage protection.
   * Defaults to "0" if not provided.
   */
  amountOutMinimum?: UniswapSwapExactInSingle["amountOutMinimum"];

  /**
   * Additional data for the hooks.
   * Defaults to "0x" if not provided.
   */
  hookData?: UniswapSwapExactInSingle["hookData"];
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
 * @returns A Promise that resolves to the quote result, including the amount out and gas estimate.
 * @throws Will throw an error if:
 * - Simulation fails (e.g., insufficient liquidity, invalid parameters)
 * - Contract call reverts
 */
export async function getQuote(params: SwapExactInSingle, instance: UniswapSDKInstance): Promise<QuoteResponse> {
  const { client, contracts } = instance;
  const { quoter } = contracts;

  try {
    // Build the parameters for quoteExactInputSingle
    // Using SwapExactInSingle structure directly from Uniswap V4 SDK
    const quoteParams = {
      poolKey: {
        currency0: params.poolKey.currency0 as Address,
        currency1: params.poolKey.currency1 as Address,
        fee: params.poolKey.fee,
        tickSpacing: params.poolKey.tickSpacing,
        hooks: params.poolKey.hooks as Address,
      },
      zeroForOne: params.zeroForOne,
      exactAmount: BigInt(params.amountIn),
      hookData: (params.hookData || "0x") as Hex,
    };

    // Simulate the quote to estimate the amount out
    const simulation = await client.simulateContract({
      address: quoter,
      abi: v4.QuoterArtifact.abi,
      functionName: "quoteExactInputSingle",
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
