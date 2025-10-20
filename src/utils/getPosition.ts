import { Pool, Position as V4Position } from '@uniswap/v4-sdk'
import V4PositionManagerAbi from '@/constants/abis/V4PositionMananger'
import V4StateViewAbi from '@/constants/abis/V4StateView'
import { decodePositionInfo } from '@/helpers/positions'
import type { UniDevKitV4Instance } from '@/types/core'
import type {
  GetPositionDetailsResponse,
  GetPositionParams,
  GetPositionResponse,
} from '@/types/utils/getPosition'
import { getTokens } from '@/utils/getTokens'

/**
 * Retrieves a Uniswap V4 position instance for a given token ID.
 * @param params Position parameters including token ID
 * @param instance UniDevKitV4Instance
 * @returns Promise resolving to position data
 * @throws Error if SDK instance is not found or if position data is invalid
 */
export async function getPosition(
  params: GetPositionParams,
  instance: UniDevKitV4Instance,
): Promise<GetPositionResponse> {
  const { client, contracts } = instance

  const { stateView } = contracts

  // Get position details using the dedicated function
  const positionDetails = await getPositionDetails(params.tokenId, instance)

  const { poolKey, liquidity, tickLower, tickUpper } = positionDetails
  const { currency0, currency1, fee, tickSpacing, hooks } = poolKey

  if (liquidity === 0n) {
    throw new Error('Liquidity is 0')
  }

  const tokens = await getTokens(
    {
      addresses: [currency0 as `0x${string}`, currency1 as `0x${string}`],
    },
    instance,
  )

  if (!tokens) {
    throw new Error('Tokens not found')
  }

  const [token0, token1] = tokens

  const poolId = Pool.getPoolId(token0, token1, fee, tickSpacing, hooks) as `0x${string}`

  const [slot0, poolLiquidity] = await client.multicall({
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

  const [sqrtPriceX96, tick] = slot0

  const pool = new Pool(
    token0,
    token1,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96.toString(),
    poolLiquidity.toString(),
    tick,
  )

  const position = new V4Position({
    pool,
    liquidity: liquidity.toString(),
    tickLower,
    tickUpper,
  })

  return {
    position,
    pool,
    token0,
    token1,
    poolId,
    tokenId: params.tokenId,
  }
}

/**
 * Retrieves a Uniswap V4 position instance for a given token ID.
 * @param params Position parameters including token ID
 * @param instance UniDevKitV4Instance
 * @returns Promise<GetPositionDetailsResponse>
 */
export async function getPositionDetails(
  tokenId: string,
  instance: UniDevKitV4Instance,
): Promise<GetPositionDetailsResponse> {
  const { client, contracts } = instance

  const { positionManager } = contracts

  // Fetch poolKey and raw position info
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

  const positionInfo = decodePositionInfo(poolAndPositionInfo[1])

  return {
    tokenId,
    tickLower: positionInfo.tickLower,
    tickUpper: positionInfo.tickUpper,
    liquidity,
    poolKey: poolAndPositionInfo[0],
  }
}
