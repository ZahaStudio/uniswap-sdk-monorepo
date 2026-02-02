import type { Address } from "viem";

/**
 * Arguments for getTokens function
 */
export interface GetTokensArgs {
  /** Array of token contract addresses (at least one) */
  addresses: [Address, ...Address[]];
}
