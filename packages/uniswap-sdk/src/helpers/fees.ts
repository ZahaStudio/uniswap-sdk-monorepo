import { FeeTier, TICK_SPACING_BY_FEE } from "@/utils/getPool";

/**
 * Gets the appropriate tick spacing for a given fee tier.
 * @param fee The fee tier
 * @returns The corresponding tick spacing
 * @throws Error if fee tier is not supported
 */
export function getTickSpacingForFee(fee: number): number {
  if (!Object.values(FeeTier).includes(fee)) {
    throw new Error(`Unsupported fee tier: ${fee}. Supported tiers: ${Object.values(FeeTier).join(", ")}`);
  }
  return TICK_SPACING_BY_FEE[fee as FeeTier];
}

/**
 * Validates if a fee tier is supported.
 * @param fee The fee tier to validate
 * @returns True if the fee tier is supported
 */
export function isValidFeeTier(fee: number): boolean {
  return Object.values(FeeTier).includes(fee);
}

/**
 * Gets the percentage representation of a fee tier.
 * @param fee The fee tier
 * @returns The fee as a percentage string
 * @throws Error if fee tier is not supported
 */
export function getFeePercentage(fee: number): string {
  if (!isValidFeeTier(fee)) {
    throw new Error(`Unsupported fee tier: ${fee}`);
  }
  return `${(fee / 10000).toFixed(2)}%`;
}
