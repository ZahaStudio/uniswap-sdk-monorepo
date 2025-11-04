import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v4-sdk'
import { type Address, zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { FeeTier } from '@/types/utils/getPool'
import { getPool } from '@/utils/getPool'

const mockGetInstance = vi.fn()
const mockGetTokens = vi.fn()
const mockUseReadContracts = vi.fn()

vi.mock('@/core/uniDevKitV4Factory', () => ({
  getInstance: () => mockGetInstance(),
}))

vi.mock('@/utils/getTokens', () => ({
  getTokens: () => mockGetTokens(),
}))

vi.mock('wagmi', () => ({
  useReadContracts: () => mockUseReadContracts(),
}))

describe('getPool', () => {
  // USDC and WETH on Mainnet
  const mockCurrencies: [Address, Address] = [
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  ]

  const mockDeps = createMockSdkInstance()

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should throw error if pool does not exist', async () => {
    const mockCurrencyInstances = [
      new Token(1, mockCurrencies[0], 18, 'CURRENCY0', 'Currency 0'),
      new Token(1, mockCurrencies[1], 18, 'CURRENCY1', 'Currency 1'),
    ]

    const mockPoolData = [
      [mockCurrencies[0], mockCurrencies[1], FeeTier.MEDIUM, 0, zeroAddress], // poolKeys with 0 tickSpacing
      null, // slot0
      null, // liquidity
    ]

    mockGetTokens.mockResolvedValueOnce(mockCurrencyInstances)
    vi.mocked(mockDeps.client.multicall).mockResolvedValueOnce(mockPoolData)

    await expect(
      getPool(
        {
          currencyA: mockCurrencies[0],
          currencyB: mockCurrencies[1],
          fee: FeeTier.MEDIUM,
        },
        mockDeps,
      ),
    ).rejects.toThrow('Pool does not exist')
  })

  it('should return pool when it exists', async () => {
    const mockCurrencyInstances = [
      new Token(1, mockCurrencies[0], 6, 'USDC', 'USD Coin'),
      new Token(1, mockCurrencies[1], 18, 'WETH', 'Wrapped Ether'),
    ]

    // Mock the multicall response with the correct structure
    const mockSlot0Data = ['79228162514264337593543950336', 0, 0, 0]
    const mockLiquidityData = '1000000'

    const mockPoolData = [mockSlot0Data, mockLiquidityData]

    mockGetTokens.mockResolvedValueOnce(mockCurrencyInstances)
    vi.mocked(mockDeps.client.multicall).mockResolvedValueOnce(mockPoolData)

    const result = await getPool(
      {
        currencyA: mockCurrencies[0],
        currencyB: mockCurrencies[1],
        fee: FeeTier.MEDIUM,
      },
      mockDeps,
    )

    expect(result).toBeDefined()
    expect(result).toBeInstanceOf(Pool)
  })

  it('should throw error if pool creation fails', async () => {
    const mockCurrencyInstances = [
      new Token(1, mockCurrencies[0], 18, 'CURRENCY0', 'Currency 0'),
      new Token(1, mockCurrencies[1], 18, 'CURRENCY1', 'Currency 1'),
    ]

    const mockPoolData = [
      [mockCurrencies[0], mockCurrencies[1], FeeTier.MEDIUM, 60, zeroAddress],
      ['invalid', 0, 0, 0, 0, 0], // invalid sqrtPriceX96
      '1000000000000000000',
    ]

    mockGetTokens.mockResolvedValueOnce(mockCurrencyInstances)
    vi.mocked(mockDeps.client.multicall).mockResolvedValueOnce(mockPoolData)

    await expect(
      getPool(
        {
          currencyA: mockCurrencies[0],
          currencyB: mockCurrencies[1],
          fee: FeeTier.MEDIUM,
        },
        mockDeps,
      ),
    ).rejects.toThrow('Error creating pool instance')
  })
})
