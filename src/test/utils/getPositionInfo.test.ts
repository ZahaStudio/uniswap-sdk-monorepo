import { Pool } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'

const mockGetTokens = vi.fn()
const mockDecodePositionInfo = vi.fn()

vi.mock('@/utils/getTokens', () => ({
  getTokens: mockGetTokens,
}))

vi.mock('@/helpers/positions', () => ({
  decodePositionInfo: mockDecodePositionInfo,
}))

// Mock Pool.getPoolId
vi.mock('@uniswap/v4-sdk', () => {
  const MockPool = vi.fn() as unknown as typeof Pool
  MockPool.getPoolId = vi.fn()

  return {
    Pool: MockPool,
  }
})

describe('getPositionInfo', () => {
  const mockTokenId = '1'
  const mockCurrency0Address = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address // USDC
  const mockCurrency1Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address // WETH
  const mockFee = 3000
  const mockTickSpacing = 60
  const mockHooks = '0x000000000000000000000000000000000000dead' as Address
  const mockTickLower = -887220
  const mockTickUpper = 887220
  const mockLiquidity = 1000000n
  const mockSqrtPriceX96 = 79228162514264337593543950336n
  const mockTick = 0
  const mockProtocolFee = 0
  const mockLpFee = 0
  const mockPoolLiquidity = 1000000n
  const mockPoolId =
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`

  let mockDeps: ReturnType<typeof createMockSdkInstance>
  let mockCurrency0: Token
  let mockCurrency1: Token
  let mockPoolKey: {
    currency0: Address
    currency1: Address
    fee: number
    tickSpacing: number
    hooks: Address
  }
  let mockPoolAndPositionInfo: [
    {
      currency0: Address
      currency1: Address
      fee: number
      tickSpacing: number
      hooks: Address
    },
    unknown,
  ]
  let getPositionInfo: typeof import('@/utils/getPositionInfo').getPositionInfo

  beforeEach(async () => {
    vi.resetAllMocks()
    vi.clearAllMocks()

    // Import getPositionInfo after mocks are set up
    const positionInfoModule = await import('@/utils/getPositionInfo')
    getPositionInfo = positionInfoModule.getPositionInfo

    mockDeps = createMockSdkInstance()
    mockCurrency0 = new Token(1, mockCurrency0Address, 6, 'USDC', 'USD Coin')
    mockCurrency1 = new Token(1, mockCurrency1Address, 18, 'WETH', 'Wrapped Ether')

    mockPoolKey = {
      currency0: mockCurrency0Address,
      currency1: mockCurrency1Address,
      fee: mockFee,
      tickSpacing: mockTickSpacing,
      hooks: mockHooks,
    }

    mockPoolAndPositionInfo = [mockPoolKey, {}]

    // Mock decodePositionInfo
    mockDecodePositionInfo.mockReturnValue({
      tickLower: mockTickLower,
      tickUpper: mockTickUpper,
    })

    // Mock Pool.getPoolId
    vi.mocked(Pool.getPoolId).mockReturnValue(mockPoolId)
  })

  it('should throw error if tokens is null or undefined', async () => {
    // First multicall: position info
    vi.spyOn(mockDeps.client, 'multicall').mockResolvedValueOnce([
      mockPoolAndPositionInfo,
      mockLiquidity,
    ])

    mockGetTokens.mockResolvedValueOnce(null as never)

    await expect(getPositionInfo(mockTokenId, mockDeps)).rejects.toThrow(
      'Failed to fetch token instances',
    )
  })

  it('should throw error if tokens array length is less than 2', async () => {
    // First multicall: position info
    vi.spyOn(mockDeps.client, 'multicall').mockResolvedValueOnce([
      mockPoolAndPositionInfo,
      mockLiquidity,
    ])

    mockGetTokens.mockResolvedValueOnce([mockCurrency0])

    await expect(getPositionInfo(mockTokenId, mockDeps)).rejects.toThrow(
      'Failed to fetch token instances',
    )
  })

  it('should return correct data when all operations succeed', async () => {
    const mockSlot0 = [mockSqrtPriceX96, mockTick, mockProtocolFee, mockLpFee] as const

    // First multicall: position info
    vi.spyOn(mockDeps.client, 'multicall')
      .mockResolvedValueOnce([mockPoolAndPositionInfo, mockLiquidity])
      // Second multicall: pool state
      .mockResolvedValueOnce([mockSlot0, mockPoolLiquidity])

    mockGetTokens.mockResolvedValueOnce([mockCurrency0, mockCurrency1])

    const result = await getPositionInfo(mockTokenId, mockDeps)

    // Verify first multicall was called with correct parameters
    expect(mockDeps.client.multicall).toHaveBeenNthCalledWith(1, {
      allowFailure: false,
      contracts: [
        {
          address: mockDeps.contracts.positionManager,
          abi: expect.any(Object),
          functionName: 'getPoolAndPositionInfo',
          args: [BigInt(mockTokenId)],
        },
        {
          address: mockDeps.contracts.positionManager,
          abi: expect.any(Object),
          functionName: 'getPositionLiquidity',
          args: [BigInt(mockTokenId)],
        },
      ],
    })

    // Verify decodePositionInfo was called with correct parameters
    expect(mockDecodePositionInfo).toHaveBeenCalledWith(mockPoolAndPositionInfo[1])
    expect(mockDecodePositionInfo).toHaveBeenCalledTimes(1)

    // Verify getTokens was called with correct parameters
    expect(mockGetTokens).toHaveBeenCalledWith(
      {
        addresses: [mockCurrency0Address, mockCurrency1Address],
      },
      mockDeps,
    )
    expect(mockGetTokens).toHaveBeenCalledTimes(1)

    // Verify Pool.getPoolId was called with correct parameters
    expect(Pool.getPoolId).toHaveBeenCalledWith(
      mockCurrency0,
      mockCurrency1,
      mockFee,
      mockTickSpacing,
      mockHooks,
    )
    expect(Pool.getPoolId).toHaveBeenCalledTimes(1)

    // Verify second multicall was called with correct parameters
    expect(mockDeps.client.multicall).toHaveBeenNthCalledWith(2, {
      allowFailure: false,
      contracts: [
        {
          address: mockDeps.contracts.stateView,
          abi: expect.any(Object),
          functionName: 'getSlot0',
          args: [mockPoolId],
        },
        {
          address: mockDeps.contracts.stateView,
          abi: expect.any(Object),
          functionName: 'getLiquidity',
          args: [mockPoolId],
        },
      ],
    })

    // Verify return value
    expect(result).toEqual({
      tokenId: mockTokenId,
      tickLower: mockTickLower,
      tickUpper: mockTickUpper,
      liquidity: mockLiquidity,
      poolKey: mockPoolKey,
      currentTick: mockTick,
      slot0: mockSlot0,
      poolLiquidity: mockPoolLiquidity,
      poolId: mockPoolId,
      currency0: mockCurrency0,
      currency1: mockCurrency1,
    })
  })
})
