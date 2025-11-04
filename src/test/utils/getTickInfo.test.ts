import { Pool } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { getTickInfo } from '@/utils/getTickInfo'
import type { GetTickInfoArgs } from '@/types/utils/getTickInfo'

vi.mock('@/utils/getTokens', () => ({
  getTokens: vi.fn(),
}))

vi.mock('@uniswap/v4-sdk', async () => {
  const actual = await vi.importActual<typeof import('@uniswap/v4-sdk')>('@uniswap/v4-sdk')
  return {
    ...actual,
    Pool: {
      ...actual.Pool,
      getPoolId: vi.fn(),
    },
  }
})

describe('getTickInfo', () => {
  // USDC and WETH on Mainnet
  const mockTokens: [Address, Address] = [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  ]

  const mockTickInfoArgs: GetTickInfoArgs = {
    poolKey: {
      currency0: mockTokens[0],
      currency1: mockTokens[1],
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000',
    },
    tick: 0,
  }

  const mockDeps = createMockSdkInstance()

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should throw error if SDK instance not found', async () => {
    const mockDeps = createMockSdkInstance()
    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens).mockRejectedValueOnce(new Error())

    await expect(getTickInfo(mockTickInfoArgs, mockDeps)).rejects.toThrow()
  })

  it('should complete full flow and verify function calls', async () => {
    const mockTokenInstances = [
      new Token(1, mockTokens[0], 6, 'USDC', 'USD Coin'),
      new Token(1, mockTokens[1], 18, 'WETH', 'Wrapped Ether'),
    ]

    const mockPoolId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const mockTickInfoResult: [bigint, bigint, bigint, bigint] = [
      BigInt('1000000000000000000'), // liquidityGross
      BigInt('500000000000000000'), // liquidityNet
      BigInt('2000000000000000000'), // feeGrowthOutside0X128
      BigInt('1500000000000000000'), // feeGrowthOutside1X128
    ]

    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens).mockResolvedValueOnce(mockTokenInstances)
    vi.mocked(Pool.getPoolId).mockReturnValueOnce(mockPoolId as `0x${string}`)
    mockDeps.client.readContract = vi.fn().mockResolvedValueOnce(mockTickInfoResult)

    const result = await getTickInfo(mockTickInfoArgs, mockDeps)

    // Verify getTokens was called with correct parameters
    expect(getTokens).toHaveBeenCalledWith(
      {
        addresses: [mockTickInfoArgs.poolKey.currency0, mockTickInfoArgs.poolKey.currency1],
      },
      mockDeps,
    )

    // Verify Pool.getPoolId was called with correct parameters
    expect(Pool.getPoolId).toHaveBeenCalledWith(
      mockTokenInstances[0],
      mockTokenInstances[1],
      mockTickInfoArgs.poolKey.fee,
      mockTickInfoArgs.poolKey.tickSpacing,
      mockTickInfoArgs.poolKey.hooks,
    )

    // Verify readContract was called with correct parameters
    expect(mockDeps.client.readContract).toHaveBeenCalledWith({
      address: mockDeps.contracts.stateView,
      abi: expect.any(Object),
      functionName: 'getTickInfo',
      args: [mockPoolId, mockTickInfoArgs.tick],
    })

    // Verify result structure
    expect(result).toEqual({
      liquidityGross: mockTickInfoResult[0],
      liquidityNet: mockTickInfoResult[1],
      feeGrowthOutside0X128: mockTickInfoResult[2],
      feeGrowthOutside1X128: mockTickInfoResult[3],
    })
  })

  it('should throw error if readContract fails', async () => {
    const mockTokenInstances = [
      new Token(1, mockTokens[0], 6, 'USDC', 'USD Coin'),
      new Token(1, mockTokens[1], 18, 'WETH', 'Wrapped Ether'),
    ]

    const mockPoolId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens).mockResolvedValueOnce(mockTokenInstances)
    vi.mocked(Pool.getPoolId).mockReturnValueOnce(mockPoolId as `0x${string}`)
    mockDeps.client.readContract = vi.fn().mockRejectedValueOnce(new Error())

    await expect(getTickInfo(mockTickInfoArgs, mockDeps)).rejects.toThrow()
  })
})
