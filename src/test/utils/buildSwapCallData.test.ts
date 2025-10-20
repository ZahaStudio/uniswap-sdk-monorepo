import { zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'
import { createTestPool } from '@/test/helpers/testFactories'
import { buildSwapCallData } from '@/utils/buildSwapCallData'
import * as getQuoteModule from '@/utils/getQuote'

// Mock getQuote to return a fixed amount
vi.spyOn(getQuoteModule, 'getQuote').mockImplementation(async () => ({
  amountOut: BigInt(1000000000000000000), // 1 WETH
  estimatedGasUsed: BigInt(100000),
  timestamp: Date.now(),
}))

describe('buildSwapCallData', () => {
  const mockPool = createTestPool()

  it.each([
    { amountIn: BigInt(1000000), zeroForOne: true, description: 'USDC to WETH' },
    { amountIn: BigInt(1000000000000000000), zeroForOne: false, description: 'WETH to USDC' },
  ])('should build swap calldata for $description', async ({ amountIn, zeroForOne }) => {
    const params = {
      amountIn,
      amountOutMinimum: BigInt(950000000000000000), // 0.95 WETH (5% slippage)
      pool: mockPool,
      zeroForOne,
      recipient: zeroAddress,
    }

    const calldata = await buildSwapCallData(params)
    expect(calldata).toMatch(/^0x[a-fA-F0-9]+$/)
    expect(calldata.length).toBeGreaterThan(10) // Basic validation it's not empty
  })

  it('should handle different amountOutMinimum values', async () => {
    const params = {
      amountIn: BigInt(1000000),
      amountOutMinimum: BigInt(900000000000000000), // 0.9 WETH (10% slippage)
      pool: mockPool,
      zeroForOne: true,
      recipient: zeroAddress,
    }

    const calldata = await buildSwapCallData(params)
    expect(calldata).toMatch(/^0x[a-fA-F0-9]+$/)
  })
})
