import { Pool, Position as V4Position } from '@uniswap/v4-sdk'
import V4PositionManagerAbi from '@/constants/abis/V4PositionMananger'
import V4StateViewAbi from '@/constants/abis/V4StateView'
import { decodePositionInfo } from '@/helpers/positions'
import type { UniDevKitV4Instance } from '@/types/core'
import type { GetPositionInfoResponse, GetPositionResponse } from '@/types/utils/getPosition'
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

/**
 * Retrieves basic position information.
 *
 * This method fetches raw position data from the blockchain and returns it without creating
 * SDK instances. It's more efficient when you only need position metadata (tick range, liquidity,
 * pool key) without requiring Position or Pool objects. Also fetches pool state (slot0 and liquidity)
 *
 * Use this method when:
 * - Displaying position information in a UI
 * - Checking if a position exists
 * - Getting position metadata without SDK operations
 *
 * Use `getPosition()` instead when you need SDK instances for swaps, calculations, or other operations.
 *
 * @param tokenId - The NFT token ID of the position
 * @param instance - UniDevKitV4Instance
 * @returns Promise<GetPositionInfoResponse> - Basic position information with pool state
 * @throws Error if position data cannot be fetched or position doesn't exist
 */
export async function getPositionInfo(
  tokenId: string,
  instance: UniDevKitV4Instance,
): Promise<GetPositionInfoResponse> {
  const { client, contracts } = instance

  const { positionManager, stateView } = contracts

  // Fetch poolKey and raw position info using multicall
  const [poolAndPositionInfo, liquidity] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: positionManager,
        abi: V4PositionManagerAbi,
        functionName: 'getPoolAndPositionInfo',
        args: [BigInt(tokenId)],
      },
      {
        address: positionManager,
        abi: V4PositionManagerAbi,
        functionName: 'getPositionLiquidity',
        args: [BigInt(tokenId)],
      },
    ],
  })

  // Decode packed position data to extract tick range
  const positionInfo = decodePositionInfo(poolAndPositionInfo[1])
  const poolKey = poolAndPositionInfo[0]

  // Get token instances to compute poolId
  const tokens = await getTokens(
    {
      addresses: [poolKey.currency0 as `0x${string}`, poolKey.currency1 as `0x${string}`],
    },
    instance,
  )

  if (!tokens || tokens.length < 2) {
    throw new Error('Failed to fetch token instances')
  }

  const [currency0, currency1] = tokens

  // Compute pool ID from pool key components
  const poolId = Pool.getPoolId(
    currency0,
    currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks,
  ) as `0x${string}`

  // Fetch pool state (slot0 and liquidity) in a single multicall
  const [slot0Result, poolLiquidityResult] = await client.multicall({
    allowFailure: false,
    contracts: [
      {
        address: stateView,
        abi: V4StateViewAbi,
        functionName: 'getSlot0',
        args: [poolId],
      },
      {
        address: stateView,
        abi: V4StateViewAbi,
        functionName: 'getLiquidity',
        args: [poolId],
      },
    ],
  })

  const [, tick] = slot0Result

  return {
    tokenId,
    tickLower: positionInfo.tickLower,
    tickUpper: positionInfo.tickUpper,
    liquidity,
    poolKey,
    currentTick: Number(tick),
    slot0: slot0Result,
    poolLiquidity: poolLiquidityResult,
    poolId,
    currency0,
    currency1,
  }
}
