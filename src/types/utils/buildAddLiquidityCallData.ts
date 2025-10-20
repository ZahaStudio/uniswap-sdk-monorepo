import type { BatchPermitOptions, Pool } from '@uniswap/v4-sdk'

/**
 * Common base parameters for building add liquidity call data.
 */
type BaseAddLiquidityArgs = {
  /**
   * The Uniswap V4 pool to add liquidity to.
   */
  pool: Pool

  /**
   * Amount of token0 to add.
   */
  amount0?: string

  /**
   * Amount of token1 to add.
   */
  amount1?: string

  /**
   * Address that will receive the position (NFT).
   */
  recipient: string

  /**
   * Lower tick boundary for the position.
   * Defaults to nearest usable MIN_TICK.
   */
  tickLower?: number

  /**
   * Upper tick boundary for the position.
   * Defaults to nearest usable MAX_TICK.
   */
  tickUpper?: number

  /**
   * Maximum acceptable slippage for the operation (in basis points).
   * e.g. 50 = 0.5%.
   * Defaults to 50.
   */
  slippageTolerance?: number

  /**
   * Unix timestamp (in seconds) after which the transaction will revert.
   * Defaults to current block timestamp + 1800 (30 minutes).
   */
  deadline?: string

  /**
   * Optional Permit2 batch signature for token approvals.
   */
  permit2BatchSignature?: BatchPermitOptions
}

export type BuildAddLiquidityArgs = BaseAddLiquidityArgs

/**
 * Result of building add liquidity call data.
 */
export interface BuildAddLiquidityCallDataResult {
  /**
   * Encoded calldata for the `mint` operation via V4PositionManager.
   */
  calldata: string

  /**
   * Amount of native currency to send with the transaction (if needed).
   * Stringified bigint.
   */
  value: string
}
