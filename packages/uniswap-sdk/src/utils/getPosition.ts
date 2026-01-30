import type { Currency } from "@uniswap/sdk-core";
import type { Pool, PoolKey, Position } from "@uniswap/v4-sdk";
import { Position as V4Position } from "@uniswap/v4-sdk";

import type { UniswapSDKInstance } from "@/core/sdk";
import { getPositionInfo } from "@/utils/getPositionInfo";
import { getTokens } from "@/utils/getTokens";

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

/**
 * Retrieves a complete Uniswap V4 position with initialized SDK instances.
 *
 * This method fetches position information and creates fully initialized Position and Pool
 * instances from the Uniswap V4 SDK. It validates that the position has liquidity and returns
 * objects ready for use in swaps, calculations, and other SDK operations.
 *
 * @param params Position parameters including token ID
 * @param instance UniswapSDKInstance
 * @returns Promise<GetPositionResponse> - Complete position with SDK instances
 * @throws Error if position data cannot be fetched, position doesn't exist, or liquidity is 0
 */
export async function getPosition(tokenId: string, instance: UniswapSDKInstance): Promise<GetPositionResponse> {
  // Get position info (includes slot0 and poolLiquidity to avoid redundant calls)
  const positionInfo = await getPositionInfo(tokenId, instance);

  const { poolKey, liquidity, tickLower, tickUpper, slot0, poolLiquidity } = positionInfo;
  const { currency0: currency0Address, currency1: currency1Address, fee, tickSpacing, hooks } = poolKey;

  // Validate that position has liquidity
  if (liquidity === 0n) {
    throw new Error("Position has no liquidity");
  }

  // Get token instances
  const tokens = await getTokens(
    {
      addresses: [currency0Address as `0x${string}`, currency1Address as `0x${string}`],
    },
    instance,
  );

  if (!tokens || tokens.length < 2) {
    throw new Error("Failed to fetch token instances");
  }

  const [currency0, currency1] = tokens;

  // Compute pool ID
  const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks) as `0x${string}`;

  // Extract slot0 data (already fetched in getPositionInfo)
  const [sqrtPriceX96, tick] = slot0;

  // Create Pool instance with current state
  const pool = new Pool(
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96.toString(),
    poolLiquidity.toString(),
    tick,
  );

  // Create Position instance
  const position = new V4Position({
    pool,
    liquidity: liquidity.toString(),
    tickLower,
    tickUpper,
  });

  return {
    position,
    pool,
    currency0,
    currency1,
    poolId,
    tokenId,
    currentTick: Number(tick),
  };
}
