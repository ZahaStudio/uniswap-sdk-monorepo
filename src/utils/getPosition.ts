import { Pool, Position as V4Position } from '@uniswap/v4-sdk'
import type { UniDevKitV4Instance } from '@/types/core'
import type { GetPositionResponse } from '@/types/utils/getPosition'
import { getPositionInfo } from '@/utils/getPositionInfo'
import { getTokens } from '@/utils/getTokens'

/**
 * Retrieves a complete Uniswap V4 position with initialized SDK instances.
 *
 * This method fetches position information and creates fully initialized Position and Pool
 * instances from the Uniswap V4 SDK. It validates that the position has liquidity and returns
 * objects ready for use in swaps, calculations, and other SDK operations.
 *
 * @param params Position parameters including token ID
 * @param instance UniDevKitV4Instance
 * @returns Promise<GetPositionResponse> - Complete position with SDK instances
 * @throws Error if position data cannot be fetched, position doesn't exist, or liquidity is 0
 */
export async function getPosition(
  tokenId: string,
  instance: UniDevKitV4Instance,
): Promise<GetPositionResponse> {
  // Get position info (includes slot0 and poolLiquidity to avoid redundant calls)
  const positionInfo = await getPositionInfo(tokenId, instance)

  const { poolKey, liquidity, tickLower, tickUpper, slot0, poolLiquidity } = positionInfo
  const {
    currency0: currency0Address,
    currency1: currency1Address,
    fee,
    tickSpacing,
    hooks,
  } = poolKey

  // Validate that position has liquidity
  if (liquidity === 0n) {
    throw new Error('Position has no liquidity')
  }

  // Get token instances
  const tokens = await getTokens(
    {
      addresses: [currency0Address as `0x${string}`, currency1Address as `0x${string}`],
    },
    instance,
  )

  if (!tokens || tokens.length < 2) {
    throw new Error('Failed to fetch token instances')
  }

  const [currency0, currency1] = tokens

  // Compute pool ID
  const poolId = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks) as `0x${string}`

  // Extract slot0 data (already fetched in getPositionInfo)
  const [sqrtPriceX96, tick] = slot0

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
  )

  // Create Position instance
  const position = new V4Position({
    pool,
    liquidity: liquidity.toString(),
    tickLower,
    tickUpper,
  })

  return {
    position,
    pool,
    currency0,
    currency1,
    poolId,
    tokenId,
    currentTick: Number(tick),
  }
}
