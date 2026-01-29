import { v4 } from "hookmate/abi";

import type { UniswapSDKInstance } from "@/types/core";
import type { SwapExactInSingle, QuoteResponse } from "@/types/utils/getQuote";

/**
 * Fetches a quote for a token swap using the V4 Quoter contract.
 * This function uses the provided pool instance to simulate the quote.
 *
 * @param params - The parameters required for the quote, including pool and amount.
 * @param instance - UniDevKitV4 instance for contract interaction
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
        currency0: params.poolKey.currency0 as `0x${string}`,
        currency1: params.poolKey.currency1 as `0x${string}`,
        fee: params.poolKey.fee,
        tickSpacing: params.poolKey.tickSpacing,
        hooks: params.poolKey.hooks as `0x${string}`,
      },
      zeroForOne: params.zeroForOne,
      exactAmount: BigInt(params.amountIn),
      hookData: (params.hookData || "0x") as `0x${string}`,
    };

    // Simulate the quote to estimate the amount out
    const simulation = await client.simulateContract({
      address: quoter,
      abi: v4.QuoterArtifact.abi,
      functionName: "quoteExactInputSingle",
      args: [quoteParams],
    });

    // Extract the results
    const [amountOut, gasEstimate] = simulation.result;

    return {
      amountOut,
      estimatedGasUsed: gasEstimate,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Error simulating quote:", error);
    throw new Error(`Failed to fetch quote: ${(error as Error).message}`);
  }
}
