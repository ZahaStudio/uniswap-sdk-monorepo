import { Pool, Position as V4Position } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import type { GetPositionInfoResponse } from '@/types/utils/getPosition'

const mockGetPositionInfo = vi.fn()
const mockGetTokens = vi.fn()

vi.mock('@/utils/getTokens', () => ({
  getTokens: mockGetTokens,
}))

vi.mock('@/utils/getPositionInfo', () => ({
  getPositionInfo: mockGetPositionInfo,
}))

// Mock Pool and V4Position constructors
vi.mock('@uniswap/v4-sdk', () => {
  const MockPool = vi.fn() as unknown as typeof Pool
  MockPool.getPoolId = vi.fn()

  const MockPosition = vi.fn() as unknown as typeof V4Position

  return {
    Pool: MockPool,
    Position: MockPosition,
  }
})

describe('getPosition', () => {
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
  let mockPositionInfo: GetPositionInfoResponse
  let mockPool: Pool
  let mockPosition: V4Position
  let getPosition: typeof import('@/utils/getPosition').getPosition

  beforeEach(async () => {
    vi.resetAllMocks()
    vi.clearAllMocks()

    // Import getPosition after mocks are set up
    const positionModule = await import('@/utils/getPosition')
    getPosition = positionModule.getPosition

    mockDeps = createMockSdkInstance()
    mockCurrency0 = new Token(1, mockCurrency0Address, 6, 'USDC', 'USD Coin')
    mockCurrency1 = new Token(1, mockCurrency1Address, 18, 'WETH', 'Wrapped Ether')

    mockPositionInfo = {
      tokenId: mockTokenId,
      tickLower: mockTickLower,
      tickUpper: mockTickUpper,
      liquidity: mockLiquidity,
      poolKey: {
        currency0: mockCurrency0Address,
        currency1: mockCurrency1Address,
        fee: mockFee,
        tickSpacing: mockTickSpacing,
        hooks: mockHooks,
      },
      currentTick: mockTick,
      slot0: [mockSqrtPriceX96, mockTick, mockProtocolFee, mockLpFee],
      poolLiquidity: mockPoolLiquidity,
      poolId: mockPoolId,
      currency0: mockCurrency0,
      currency1: mockCurrency1,
    }

    // Create mock instances
    mockPool = {
      currency0: mockCurrency0,
      currency1: mockCurrency1,
    } as unknown as Pool

    mockPosition = {
      pool: mockPool,
      liquidity: mockLiquidity.toString(),
    } as unknown as V4Position

    // Mock constructors to return our mock instances
    vi.mocked(Pool).mockReturnValue(mockPool)
    vi.mocked(V4Position).mockReturnValue(mockPosition)

    // Mock Pool.getPoolId to return our mock pool ID
    vi.mocked(Pool.getPoolId).mockReturnValue(mockPoolId)
  })

  it('should throw error if liquidity is 0', async () => {
    mockGetPositionInfo.mockResolvedValueOnce({
      ...mockPositionInfo,
      liquidity: 0n,
    })

    await expect(getPosition(mockTokenId, mockDeps)).rejects.toThrow('Position has no liquidity')
  })

  it('should throw error if tokens is null or undefined', async () => {
    mockGetPositionInfo.mockResolvedValueOnce(mockPositionInfo)
    mockGetTokens.mockResolvedValueOnce(null as never)

    await expect(getPosition(mockTokenId, mockDeps)).rejects.toThrow(
      'Failed to fetch token instances',
    )
  })

  it('should throw error if tokens array length is less than 2', async () => {
    mockGetPositionInfo.mockResolvedValueOnce(mockPositionInfo)
    mockGetTokens.mockResolvedValueOnce([mockCurrency0])

    await expect(getPosition(mockTokenId, mockDeps)).rejects.toThrow(
      'Failed to fetch token instances',
    )
  })

  it('should return correct data when all operations succeed', async () => {
    mockGetPositionInfo.mockResolvedValueOnce(mockPositionInfo)
    mockGetTokens.mockResolvedValueOnce([mockCurrency0, mockCurrency1])

    const result = await getPosition(mockTokenId, mockDeps)

    // Verify getPositionInfo was called with correct parameters
    expect(mockGetPositionInfo).toHaveBeenCalledWith(mockTokenId, mockDeps)
    expect(mockGetPositionInfo).toHaveBeenCalledTimes(1)

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

    // Verify Pool constructor was called with correct parameters
    expect(Pool).toHaveBeenCalledWith(
      mockCurrency0,
      mockCurrency1,
      mockFee,
      mockTickSpacing,
      mockHooks,
      mockSqrtPriceX96.toString(),
      mockPoolLiquidity.toString(),
      mockTick,
    )

    // Verify V4Position constructor was called with correct parameters
    expect(V4Position).toHaveBeenCalledWith({
      pool: mockPool,
      liquidity: mockLiquidity.toString(),
      tickLower: mockTickLower,
      tickUpper: mockTickUpper,
    })

    // Verify return value
    expect(result).toEqual({
      position: mockPosition,
      pool: mockPool,
      currency0: mockCurrency0,
      currency1: mockCurrency1,
      poolId: mockPoolId,
      tokenId: mockTokenId,
      currentTick: mockTick,
    })
  })
})
