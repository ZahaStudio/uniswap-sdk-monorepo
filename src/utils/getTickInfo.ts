import { Pool } from '@uniswap/v4-sdk'
import V4StateViewAbi from '@/constants/abis/V4StateView'
import { getTokens } from '@/utils/getTokens'
import type { UniDevKitV4Instance } from '@/types/core'
import type { GetTickInfoArgs, TickInfoResponse } from '@/types/utils/getTickInfo'

/**
 * Reads tick info for a given pool key and tick from V4 StateView.
 */
export async function getTickInfo(
  args: GetTickInfoArgs,
  instance: UniDevKitV4Instance,
): Promise<TickInfoResponse> {
  const { client, contracts } = instance
  const { stateView } = contracts

  const { poolKey, tick } = args

  // Create Token instances for currency0 and currency1 in the provided order
  const [token0, token1] = await getTokens(
    { addresses: [poolKey.currency0 as `0x${string}`, poolKey.currency1 as `0x${string}`] },
    instance,
  )

  // Compute PoolId from PoolKey components
  const poolId32Bytes = Pool.getPoolId(
    token0,
    token1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks as `0x${string}`,
  ) as `0x${string}`

  // Read tick info
  const result = await client.readContract({
    address: stateView,
    abi: V4StateViewAbi,
    functionName: 'getTickInfo',
    args: [poolId32Bytes, tick],
  })

  // V4 StateView getTickInfo returns:
  // (uint128 liquidityGross, int128 liquidityNet, uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128)
  const [liquidityGross, liquidityNet, feeGrowthOutside0X128, feeGrowthOutside1X128] =
    result as unknown as [bigint, bigint, bigint, bigint]

  return {
    liquidityGross,
    liquidityNet,
    feeGrowthOutside0X128,
    feeGrowthOutside1X128,
  }
}
