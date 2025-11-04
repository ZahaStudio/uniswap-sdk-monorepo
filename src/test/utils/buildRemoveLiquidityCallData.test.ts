import { V4PositionManager } from '@uniswap/v4-sdk'
import { Percent } from '@uniswap/sdk-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { createMockPositionData, createTestPool } from '@/test/helpers/testFactories'
import { getPosition } from '@/utils/getPosition'
import { getDefaultDeadline } from '@/utils/getDefaultDeadline'
import { percentFromBips } from '@/helpers/percent'
import { DEFAULT_SLIPPAGE_TOLERANCE } from '@/constants/common'
import type { GetPositionResponse } from '@/types/utils/getPosition'
import { buildRemoveLiquidityCallData } from '@/utils/buildRemoveLiquidityCallData'

// Test constants
const MOCK_DEADLINE = BigInt(1234567890)
const MOCK_DEADLINE_STRING = '1234567890'
const MOCK_SLIPPAGE_PERCENT = new Percent(50, 10000) // 0.5%
const MOCK_CALLDATA = '0x1234567890abcdef'
const MOCK_VALUE = '0x0'
const CUSTOM_SLIPPAGE_BIPS = 500 // 5%
const CUSTOM_DEADLINE = '1234567890'
const CUSTOM_LIQUIDITY_PERCENTAGE = 7500 // 75%
const MOCK_TOKEN_ID = '123'

// Mock the V4PositionManager.removeCallParameters method
vi.mock('@uniswap/v4-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uniswap/v4-sdk')>()
  return {
    ...actual,
    V4PositionManager: {
      ...actual.V4PositionManager,
      removeCallParameters: vi.fn(),
    },
  }
})

// Mock getPosition
vi.mock('@/utils/getPosition', () => ({
  getPosition: vi.fn(),
}))

// Mock getDefaultDeadline
vi.mock('@/utils/getDefaultDeadline', () => ({
  getDefaultDeadline: vi.fn(),
}))

// Mock percentFromBips
vi.mock('@/helpers/percent', () => ({
  percentFromBips: vi.fn(),
}))

// Type for the options passed to V4PositionManager.removeCallParameters
type RemoveCallParametersOptions = {
  slippageTolerance: unknown
  deadline: string
  liquidityPercentage: unknown
  tokenId: string
}

describe('buildRemoveLiquidityCallData', () => {
  const instance = createMockSdkInstance()
  const pool = createTestPool()
  const mockPositionData = createMockPositionData(pool)

  // Get mocked functions at module level
  const mockRemoveCallParameters = vi.mocked(V4PositionManager.removeCallParameters)
  const mockGetPosition = vi.mocked(getPosition)
  const mockGetDefaultDeadline = vi.mocked(getDefaultDeadline)
  const mockPercentFromBips = vi.mocked(percentFromBips)

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockRemoveCallParameters.mockReturnValue({
      calldata: MOCK_CALLDATA,
      value: MOCK_VALUE,
    })

    mockGetPosition.mockResolvedValue(mockPositionData)
    mockGetDefaultDeadline.mockResolvedValue(MOCK_DEADLINE)
    mockPercentFromBips.mockReturnValue(MOCK_SLIPPAGE_PERCENT)
  })

  it('should call V4PositionManager.removeCallParameters with correct parameters when all required params are provided', async () => {
    const params = {
      liquidityPercentage: 10_000, // 100%
      tokenId: MOCK_TOKEN_ID,
      deadline: CUSTOM_DEADLINE,
      slippageTolerance: CUSTOM_SLIPPAGE_BIPS,
    }

    const result = await buildRemoveLiquidityCallData(params, instance)

    // Verify getPosition was called with correct tokenId
    expect(mockGetPosition).toHaveBeenCalledWith(MOCK_TOKEN_ID, instance)

    // Verify getDefaultDeadline was NOT called since custom deadline was provided
    expect(mockGetDefaultDeadline).not.toHaveBeenCalled()

    // Verify percentFromBips was called with custom slippage
    expect(mockPercentFromBips).toHaveBeenCalledWith(CUSTOM_SLIPPAGE_BIPS)
    expect(mockPercentFromBips).toHaveBeenCalledWith(10_000) // liquidityPercentage

    // Verify V4PositionManager.removeCallParameters was called with exact parameters
    expect(mockRemoveCallParameters).toHaveBeenCalledTimes(1)
    const [position, options] = mockRemoveCallParameters.mock.calls[0]

    expect(position).toBe(mockPositionData.position)
    expect(options).toEqual({
      slippageTolerance: MOCK_SLIPPAGE_PERCENT,
      deadline: CUSTOM_DEADLINE,
      liquidityPercentage: MOCK_SLIPPAGE_PERCENT, // percentFromBips result for liquidityPercentage
      tokenId: MOCK_TOKEN_ID,
    })

    // Verify return value
    expect(result).toEqual({
      calldata: MOCK_CALLDATA,
      value: MOCK_VALUE,
    })
  })

  it('should call V4PositionManager.removeCallParameters with default deadline when not provided', async () => {
    const params = {
      liquidityPercentage: CUSTOM_LIQUIDITY_PERCENTAGE,
      tokenId: MOCK_TOKEN_ID,
    }

    await buildRemoveLiquidityCallData(params, instance)

    // Verify getDefaultDeadline was called
    expect(mockGetDefaultDeadline).toHaveBeenCalledWith(instance)

    // Verify percentFromBips was called with default slippage
    expect(mockPercentFromBips).toHaveBeenCalledWith(DEFAULT_SLIPPAGE_TOLERANCE)
    expect(mockPercentFromBips).toHaveBeenCalledWith(CUSTOM_LIQUIDITY_PERCENTAGE)

    expect(mockRemoveCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockRemoveCallParameters.mock.calls[0]

    expect((options as RemoveCallParametersOptions).deadline).toBe(MOCK_DEADLINE_STRING)
    expect((options as RemoveCallParametersOptions).slippageTolerance).toEqual(
      MOCK_SLIPPAGE_PERCENT,
    )
  })

  it('should call V4PositionManager.removeCallParameters with default slippage when not provided', async () => {
    const params = {
      liquidityPercentage: 5000, // 50%
      tokenId: MOCK_TOKEN_ID,
      deadline: CUSTOM_DEADLINE,
    }

    await buildRemoveLiquidityCallData(params, instance)

    // Verify percentFromBips was called with default slippage
    expect(mockPercentFromBips).toHaveBeenCalledWith(DEFAULT_SLIPPAGE_TOLERANCE)
    expect(mockPercentFromBips).toHaveBeenCalledWith(5000)

    expect(mockRemoveCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockRemoveCallParameters.mock.calls[0]

    expect((options as RemoveCallParametersOptions).slippageTolerance).toEqual(
      MOCK_SLIPPAGE_PERCENT,
    )
  })

  it('should throw error when position is not found', async () => {
    mockGetPosition.mockResolvedValueOnce(undefined as unknown as GetPositionResponse)

    await expect(
      buildRemoveLiquidityCallData({ liquidityPercentage: 10_000, tokenId: '404' }, instance),
    ).rejects.toThrow('Position not found')

    expect(mockRemoveCallParameters).not.toHaveBeenCalled()
  })
})
