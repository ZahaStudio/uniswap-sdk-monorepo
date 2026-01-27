import type { PermitSingle } from "@uniswap/permit2-sdk";
import type { Pool } from "@uniswap/v4-sdk";
import type { Actions } from "@uniswap/v4-sdk";
import type { Address, Hex } from "viem";

/**
 * Command codes for Universal Router operations
 * @see https://docs.uniswap.org/contracts/universal-router/technical-reference
 */
export const COMMANDS = {
  PERMIT2_PERMIT: 0x0a,
  SWAP_EXACT_IN_SINGLE: 0x06,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f,
  V4_SWAP: 0x10,
} as const;

/**
 * Parameters for building a V4 swap
 */
export type BuildSwapCallDataArgs = {
  amountIn: bigint;
  amountOutMinimum: bigint;
  pool: Pool;
  /** The direction of the swap, true for currency0 to currency1, false for currency1 to currency0 */
  zeroForOne: boolean;
  //slippageTolerance?: number
  recipient: Address;
  permit2Signature?: {
    signature: Hex;
    owner: Address;
    permit: PermitSingle;
  };
  /** Custom actions to override default swap behavior. If not provided, uses default SWAP_EXACT_IN_SINGLE */
  customActions?: {
    action: Actions;
    parameters: unknown[];
  }[];
};
