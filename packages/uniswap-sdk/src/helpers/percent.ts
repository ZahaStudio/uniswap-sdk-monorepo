import { Percent } from "@uniswap/sdk-core";

export const BIPS_BASE = 10_000;

/**
 * Converts a slippage in basis points (bps) to a Uniswap `Percent` instance.
 *
 * ### Basis Points Reference
 * | Basis Points (bps) | Fraction      | Percentage |
 * |--------------------|---------------|------------|
 * | 1                  | 1 / 10_000    | 0.01%      |
 * | 10                 | 10 / 10_000   | 0.1%       |
 * | 100                | 100 / 10_000  | 1%         |
 * | 500                | 500 / 10_000  | 5%         |
 * | 1000               | 1000 / 10_000 | 10%        |
 * | 10_000             | 10_000 / 10_000 | 100%     |
 *
 * @param bps - The number of basis points (1% = 100 bps)
 * @returns A `Percent` object representing the slippage
 *
 * @example
 * ```ts
 * const slippage = slippageToPercent(50); // 0.5%
 * ```
 */
export function percentFromBips(bps: number): Percent {
  return new Percent(bps, BIPS_BASE);
}
