import type { PoolKey } from '@uniswap/v4-sdk'
import V4PositionManagerAbi from '@/constants/abis/V4PositionMananger'
import type { UniDevKitV4Instance } from '@/types/core'

/**
 * Retrieves the pool key information for a given pool ID.
 * @param params Parameters containing the pool ID
 * @returns Promise resolving to the pool key containing currency0, currency1, fee, tickSpacing, and hooks
 * @throws Error if SDK instance is not found
 */
export async function getPoolKeyFromPoolId(
  poolId: string,
  instance: UniDevKitV4Instance,
): Promise<PoolKey> {
  const { client, contracts } = instance
  const { positionManager } = contracts

  const poolId25Bytes = `0x${poolId.slice(2, 52)}` as `0x${string}`

  const [currency0, currency1, fee, tickSpacing, hooks] = await client.readContract({
    address: positionManager,
    abi: V4PositionManagerAbi,
    functionName: 'poolKeys',
    args: [poolId25Bytes],
  })

  return {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks,
  }
}
