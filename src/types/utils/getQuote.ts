import type { SwapExactInSingle as UniswapSwapExactInSingle } from '@uniswap/v4-sdk'

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
export interface SwapExactInSingle extends Partial<UniswapSwapExactInSingle> {
  /**
   * Pool key with currency addresses, fee, tick spacing, and hooks.
   * @required Must match Uniswap V4 structure exactly
   */
  poolKey: UniswapSwapExactInSingle['poolKey']

  /**
   * Direction of the swap. True if swapping from currency0 to currency1.
   * @required Must match Uniswap V4 structure exactly
   */
  zeroForOne: UniswapSwapExactInSingle['zeroForOne']

  /**
   * The amount of tokens being swapped, as string (numberish).
   * Accepts bigint.toString(), number, etc.
   * @required Must match Uniswap V4 structure exactly
   */
  amountIn: UniswapSwapExactInSingle['amountIn']

  /**
   * Optional minimum amount out for slippage protection.
   * @optional Made optional for flexibility, defaults to "0" if not provided
   */
  amountOutMinimum?: UniswapSwapExactInSingle['amountOutMinimum']

  /**
   * Optional additional data for the hooks.
   * @optional Made optional for flexibility, defaults to "0x" if not provided
   */
  hookData?: UniswapSwapExactInSingle['hookData']
}

/**
 * Response structure for a successful quote simulation.
 *
 * @example
 * ```typescript
 * const response: QuoteResponse = {
 *   amountOut: 950000n,
 *   estimatedGasUsed: 150000n,
 *   timestamp: 1703123456789
 * };
 * ```
 */
export interface QuoteResponse {
  /**
   * The estimated amount of tokens out for the given input amount.
   * @returns The output amount as a bigint
   */
  amountOut: bigint

  /**
   * The estimated gas used for the transaction.
   * @returns Gas estimate as a bigint
   */
  estimatedGasUsed: bigint

  /**
   * The timestamp when the quote was fetched.
   * @returns Unix timestamp in milliseconds
   */
  timestamp: number
}
