import type { SwapExactInSingle as UniswapSwapExactInSingle } from '@uniswap/v4-sdk'

export interface GetTickInfoArgs {
  poolKey: UniswapSwapExactInSingle['poolKey']
  tick: number
}

export interface TickInfoResponse {
  liquidityGross: bigint
  liquidityNet: bigint
  feeGrowthOutside0X128: bigint
  feeGrowthOutside1X128: bigint
}
