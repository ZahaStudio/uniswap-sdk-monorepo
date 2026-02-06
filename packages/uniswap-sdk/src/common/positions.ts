import type { Currency } from "@uniswap/sdk-core";
import type { Pool, PoolKey, Position } from "@uniswap/v4-sdk";

/**
 * Basic position information without SDK instances.
 * Returns raw position data from the blockchain.
 */
export interface GetPositionInfoResponse {
  /** The unique identifier of the position */
  tokenId: string;
  /** Lower tick boundary of the position */
  tickLower: number;
  /** Upper tick boundary of the position */
  tickUpper: number;
  /** Current liquidity amount in the position */
  liquidity: bigint;
  /** Pool configuration (currencies, fee, tick spacing, hooks) */
  poolKey: PoolKey;
  /** Current price tick of the pool */
  currentTick: number;
  /** Slot0 data from the pool (sqrtPriceX96, tick, protocolFee, lpFee) */
  slot0: readonly [bigint, number, number, number];
  /** Current total liquidity in the pool */
  poolLiquidity: bigint;
  /** The unique identifier of the pool */
  poolId: `0x${string}`;
  /** The first token in the pool pair */
  currency0: Currency;
  /** The second token in the pool pair */
  currency1: Currency;
}

/**
 * Complete position data with initialized SDK instances.
 * Returns fully usable Position and Pool objects from the Uniswap V4 SDK.
 */
export interface GetPositionResponse {
  /** The position instance from Uniswap V4 SDK */
  position: Position;
  /** The pool instance from Uniswap V4 SDK with current state */
  pool: Pool;
  /** The first token in the pool pair */
  currency0: Currency;
  /** The second token in the pool pair */
  currency1: Currency;
  /** The unique identifier of the pool */
  poolId: `0x${string}`;
  /** The unique identifier of the position */
  tokenId: string;
  /** The current price tick of the pool */
  currentTick: number;
}
