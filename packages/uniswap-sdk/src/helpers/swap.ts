import { BIPS_BASE } from "@/helpers/percent";

/**
 * Calculates the minimum output amount after applying slippage tolerance using native BigInt.
 *
 * @param expectedOutput - The expected output amount (e.g., in smallest unit)
 * @param slippageBps - Slippage in basis points (BPS). For example:
 *   - 50 = 0.5%
 *   - 100 = 1%
 *   - 1 = 0.01%
 *
 * @returns Minimum amount after slippage is applied.
 *
 * @example
 * ```ts
 * const minOut = calculateMinimumOutput(1_000_000n, 50); // 995_000n
 * ```
 */
export function calculateMinimumOutput(expectedOutput: bigint, slippageBps: number): bigint {
  const numerator = BigInt(BIPS_BASE - slippageBps);
  const denominator = BigInt(BIPS_BASE);

  return (expectedOutput * numerator) / denominator;
}
