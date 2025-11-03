import { Token } from '@uniswap/sdk-core'
import type { Address } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { getPosition } from '@/utils/getPosition'

vi.mock('@/utils/getTokens', () => ({
  getTokens: vi.fn(),
}))

// Mock decodePositionInfo para devolver ticks válidos
vi.mock('@/helpers/positions', () => ({
  decodePositionInfo: () => ({ tickLower: -887220, tickUpper: 887220 }),
}))

describe('getPosition', () => {
  // USDC and WETH on Mainnet
  const mockCurrencies: [Address, Address] = [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
  ]
  const validHooks = '0x000000000000000000000000000000000000dead'

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should throw error if SDK instance not found', async () => {
    const mockDeps = createMockSdkInstance()
    mockDeps.client.multicall = vi.fn().mockRejectedValueOnce(new Error('SDK not initialized'))

    await expect(getPosition('1', mockDeps)).rejects.toThrow('SDK not initialized')
  })

  it('should throw error if tokens not found', async () => {
    const mockDeps = createMockSdkInstance()
    // First multicall: position info
    mockDeps.client.multicall = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            currency0: '0x123',
            currency1: '0x456',
            fee: 3000,
            tickSpacing: 60,
            hooks: validHooks,
          },
          {},
        ],
        1000000n,
      ])
      // Second multicall: slot0 and poolLiquidity
      .mockResolvedValueOnce([[79228162514264337593543950336n, 0], 1000000n])

    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens).mockResolvedValueOnce([])

    await expect(getPosition('1', mockDeps)).rejects.toThrow('Failed to fetch token instances')
  })

  it('should throw error if liquidity is 0', async () => {
    const mockDeps = createMockSdkInstance()
    // Use valid addresses for tokens
    const testCurrency0 = '0x1234567890123456789012345678901234567890'
    const testCurrency1 = '0x0987654321098765432109876543210987654321'

    // First multicall: position info (from getPositionInfo)
    mockDeps.client.multicall = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            currency0: testCurrency0,
            currency1: testCurrency1,
            fee: 3000,
            tickSpacing: 60,
            hooks: validHooks,
          },
          {},
        ],
        0n,
      ])
      // Second multicall: slot0 and poolLiquidity (from getPositionInfo)
      .mockResolvedValueOnce([[79228162514264337593543950336n, 0], 1000000n])

    // Mock getTokens - called twice: once in getPositionInfo, once in getPosition
    const mockCurrency0 = new Token(1, testCurrency0, 6, 'USDC', 'USD Coin')
    const mockCurrency1 = new Token(1, testCurrency1, 18, 'WETH', 'Wrapped Ether')
    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens)
      .mockResolvedValueOnce([mockCurrency0, mockCurrency1]) // First call in getPositionInfo
      .mockResolvedValueOnce([mockCurrency0, mockCurrency1]) // Second call in getPosition

    await expect(getPosition('1', mockDeps)).rejects.toThrow('Position has no liquidity')
  })

  it('should return position data when position exists', async () => {
    const mockDeps = createMockSdkInstance()
    // First multicall: position info [poolAndPositionInfo, liquidity] (from getPositionInfo)
    mockDeps.client.multicall = vi
      .fn()
      .mockResolvedValueOnce([
        [
          {
            currency0: mockCurrencies[0],
            currency1: mockCurrencies[1],
            fee: 3000,
            tickSpacing: 60,
            hooks: validHooks,
          },
          1n,
        ],
        1000000n,
      ])
      // Second multicall: pool state [slot0, poolLiquidity] (from getPositionInfo)
      .mockResolvedValueOnce([[79228162514264337593543950336n, 0], 1000000n])

    // Mock getTokens - called twice: once in getPositionInfo, once in getPosition
    const mockCurrency0 = new Token(1, mockCurrencies[0], 6, 'USDC', 'USD Coin')
    const mockCurrency1 = new Token(1, mockCurrencies[1], 18, 'WETH', 'Wrapped Ether')
    const { getTokens } = await import('@/utils/getTokens')
    vi.mocked(getTokens)
      .mockResolvedValueOnce([mockCurrency0, mockCurrency1]) // First call in getPositionInfo
      .mockResolvedValueOnce([mockCurrency0, mockCurrency1]) // Second call in getPosition

    const result = await getPosition('1', mockDeps)

    expect(result).toHaveProperty('position')
    expect(result).toHaveProperty('pool')
    expect(result).toHaveProperty('currency0')
    expect(result).toHaveProperty('currency1')
    expect(result).toHaveProperty('poolId')
    expect(result).toHaveProperty('tokenId', '1')
    expect(result).toHaveProperty('currentTick')
  })
})
