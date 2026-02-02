import type { Address } from "viem";

/**
 * Standard fee tiers for Uniswap V4 pools.
 */
export enum FeeTier {
  LOWEST = 100, // 0.01%
  LOW = 500, // 0.05%
  MEDIUM = 3000, // 0.3%
  HIGH = 10000, // 1%
}

/**
 * Maps fee tiers to their corresponding tick spacing.
 * Following Uniswap V4's standard configurations.
 */
export const TICK_SPACING_BY_FEE: Record<FeeTier, number> = {
  [FeeTier.LOWEST]: 1,
  [FeeTier.LOW]: 10,
  [FeeTier.MEDIUM]: 60,
  [FeeTier.HIGH]: 200,
};

/**
 * Parameters for retrieving a Uniswap V4 pool instance.
 * Aligned with Uniswap V4 SDK Pool constructor parameters.
 */
export interface PoolArgs {
  /** First currency in the pool pair */
  currencyA: Address;
  /** Second currency in the pool pair */
  currencyB: Address;
  /** Fee tier of the pool (default: FeeTier.MEDIUM) */
  fee: FeeTier;
  /** Tick spacing for the pool (default: derived from fee tier) */
  tickSpacing?: number;
  /** Hooks contract address (default: DEFAULT_HOOKS) */
  hooks?: `0x${string}`;
}
