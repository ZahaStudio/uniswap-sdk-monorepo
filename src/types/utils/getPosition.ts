import type { Currency } from '@uniswap/sdk-core'
import type { Pool, PoolKey, Position } from '@uniswap/v4-sdk'

/**
 * Parameters required for retrieving a Uniswap V4 position instance.
 */
export interface GetPositionParams {
  /** The unique identifier of the position */
  tokenId: string
}

/**
 * Response structure for retrieving a Uniswap V4 position instance.
 */
export interface GetPositionDetailsResponse {
  tokenId: string
  tickLower: number
  tickUpper: number
  liquidity: bigint
  poolKey: PoolKey
}

/**
 * Response structure for retrieving a Uniswap V4 position instance.
 */
export interface GetPositionResponse {
  /** The position instance */
  position: Position
  /** The pool instance associated with the position */
  pool: Pool
  /** The first token in the pool pair */
  token0: Currency
  /** The second token in the pool pair */
  token1: Currency
  /** The unique identifier of the pool */
  poolId: `0x${string}`
  /** The unique identifier of the position */
  tokenId: string
}
