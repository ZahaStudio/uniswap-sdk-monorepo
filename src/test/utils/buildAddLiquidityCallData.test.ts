import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { createTestPool, TEST_ADDRESSES } from '@/test/helpers/testFactories'
import { buildAddLiquidityCallData } from '@/utils/buildAddLiquidityCallData'
import { V4PositionManager, Position } from '@uniswap/v4-sdk'
import { parseUnits } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultDeadline } from '@/utils/getDefaultDeadline'
import { percentFromBips } from '@/helpers/percent'
import { nearestUsableTick, encodeSqrtRatioX96, TickMath } from '@uniswap/v3-sdk'
import { DEFAULT_SLIPPAGE_TOLERANCE } from '@/constants/common'

// Test constants
const MOCK_DEADLINE = BigInt(1234567890)
const MOCK_DEADLINE_STRING = '1234567890'
const MOCK_SLIPPAGE_PERCENT = { numerator: 50n, denominator: 10000n }
const MOCK_SQRT_PRICE_X96 = '79228162514264337593543950336'
const MOCK_CALLDATA = '0x1234567890abcdef'
const MOCK_VALUE = '0x0'
const MOCK_POSITION_LIQUIDITY = '1000000'
const MOCK_POSITION_TICK_LOWER = -60
const MOCK_POSITION_TICK_UPPER = 60
const CUSTOM_SLIPPAGE_BIPS = 500 // 5%
const CUSTOM_DEADLINE = '1234567890'
const CUSTOM_TICK_LOWER = -120
const CUSTOM_TICK_UPPER = 120
const MOCK_SIGNATURE = '0x1234567890abcdef'

// Mock the V4PositionManager.addCallParameters method
vi.mock('@uniswap/v4-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uniswap/v4-sdk')>()
  return {
    ...actual,
    V4PositionManager: {
      ...actual.V4PositionManager,
      addCallParameters: vi.fn(),
    },
    Position: {
      ...actual.Position,
      fromAmounts: vi.fn(),
      fromAmount0: vi.fn(),
      fromAmount1: vi.fn(),
    },
  }
})

// Mock getDefaultDeadline
vi.mock('@/utils/getDefaultDeadline', () => ({
  getDefaultDeadline: vi.fn(),
}))

// Mock percentFromBips
vi.mock('@/helpers/percent', () => ({
  percentFromBips: vi.fn(),
}))

// Mock nearestUsableTick
vi.mock('@uniswap/v3-sdk', () => ({
  nearestUsableTick: vi.fn(),
  TickMath: {
    MIN_TICK: -887272,
    MAX_TICK: 887272,
  },
  encodeSqrtRatioX96: vi.fn(),
}))

// Type for the options passed to V4PositionManager.addCallParameters
// This includes custom properties that our implementation adds
type AddCallParametersOptions = {
  recipient: string
  deadline: string
  slippageTolerance: unknown
  createPool?: boolean
  sqrtPriceX96?: string
  useNative?: unknown
  batchPermit?: unknown
}

describe('buildAddLiquidityCallData', () => {
  const instance = createMockSdkInstance()
  const pool = createTestPool()

  // Get mocked functions at module level
  const mockAddCallParameters = vi.mocked(V4PositionManager.addCallParameters)
  const mockPositionFromAmounts = vi.mocked(Position.fromAmounts)
  const mockPositionFromAmount0 = vi.mocked(Position.fromAmount0)
  const mockPositionFromAmount1 = vi.mocked(Position.fromAmount1)
  const mockGetDefaultDeadline = vi.mocked(getDefaultDeadline)
  const mockPercentFromBips = vi.mocked(percentFromBips)
  const mockNearestUsableTick = vi.mocked(nearestUsableTick)
  const mockEncodeSqrtRatioX96 = vi.mocked(encodeSqrtRatioX96)

  // Create mock position instances
  const mockPosition = {
    pool,
    tickLower: MOCK_POSITION_TICK_LOWER,
    tickUpper: MOCK_POSITION_TICK_UPPER,
    liquidity: MOCK_POSITION_LIQUIDITY,
  } as any

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockAddCallParameters.mockReturnValue({
      calldata: MOCK_CALLDATA,
      value: MOCK_VALUE,
    })

    mockPositionFromAmounts.mockReturnValue(mockPosition)
    mockPositionFromAmount0.mockReturnValue(mockPosition)
    mockPositionFromAmount1.mockReturnValue(mockPosition)

    mockGetDefaultDeadline.mockResolvedValue(MOCK_DEADLINE)
    mockPercentFromBips.mockReturnValue(MOCK_SLIPPAGE_PERCENT as any)
    mockNearestUsableTick.mockImplementation((tick: number) => tick)
    mockEncodeSqrtRatioX96.mockReturnValue({
      toString: () => MOCK_SQRT_PRICE_X96,
    } as any)
  })

  it('should call V4PositionManager.addCallParameters with correct parameters when both amounts are provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    const amount1 = parseUnits('0.04', 18).toString()
    const params = {
      pool,
      amount0,
      amount1,
      recipient: TEST_ADDRESSES.recipient,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify getDefaultDeadline was called
    expect(mockGetDefaultDeadline).toHaveBeenCalledWith(instance)

    // Verify percentFromBips was called with default slippage (50 bips)
    expect(mockPercentFromBips).toHaveBeenCalledWith(DEFAULT_SLIPPAGE_TOLERANCE)

    // Verify nearestUsableTick was called with correct parameters for default ticks
    expect(mockNearestUsableTick).toHaveBeenCalledWith(TickMath.MIN_TICK, pool.tickSpacing)
    expect(mockNearestUsableTick).toHaveBeenCalledWith(TickMath.MAX_TICK, pool.tickSpacing)

    // Verify Position.fromAmounts was called with exact parameters
    expect(mockPositionFromAmounts).toHaveBeenCalledWith({
      pool,
      tickLower: TickMath.MIN_TICK, // nearestUsableTick result
      tickUpper: TickMath.MAX_TICK, // nearestUsableTick result
      amount0,
      amount1,
      useFullPrecision: true,
    })

    // Verify V4PositionManager.addCallParameters was called with exact parameters
    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [position, options] = mockAddCallParameters.mock.calls[0]

    expect(position).toBe(mockPosition)
    expect(options).toEqual({
      recipient: TEST_ADDRESSES.recipient,
      deadline: MOCK_DEADLINE_STRING, // getDefaultDeadline result
      slippageTolerance: MOCK_SLIPPAGE_PERCENT, // percentFromBips result
      createPool: false, // Pool has liquidity
      sqrtPriceX96: pool.sqrtRatioX96.toString(), // Pool's current sqrtPriceX96
      useNative: undefined,
      batchPermit: undefined,
    })
  })

  it('should call V4PositionManager.addCallParameters with correct parameters when only amount0 is provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    const params = {
      pool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify Position.fromAmount0 was called with exact parameters
    expect(mockPositionFromAmount0).toHaveBeenCalledWith({
      pool,
      tickLower: TickMath.MIN_TICK, // nearestUsableTick result
      tickUpper: TickMath.MAX_TICK, // nearestUsableTick result
      amount0,
      useFullPrecision: true,
    })

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [position, options] = mockAddCallParameters.mock.calls[0]

    expect(position).toBe(mockPosition)
    expect((options as AddCallParametersOptions).createPool).toBe(false)
  })

  it('should call V4PositionManager.addCallParameters with correct parameters when only amount1 is provided', async () => {
    const amount1 = parseUnits('0.04', 18).toString()
    const params = {
      pool,
      amount1,
      recipient: TEST_ADDRESSES.recipient,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify Position.fromAmount1 was called with exact parameters
    expect(mockPositionFromAmount1).toHaveBeenCalledWith({
      pool,
      tickLower: TickMath.MIN_TICK, // nearestUsableTick result
      tickUpper: TickMath.MAX_TICK, // nearestUsableTick result
      amount1,
    })

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [position, options] = mockAddCallParameters.mock.calls[0]

    expect(position).toBe(mockPosition)
    expect((options as AddCallParametersOptions).createPool).toBe(false)
  })

  it('should call V4PositionManager.addCallParameters with createPool=true when pool has no liquidity', async () => {
    const emptyPool = createTestPool()
    // Mock pool with no liquidity
    Object.defineProperty(emptyPool, 'liquidity', {
      value: { toString: () => '0' },
      writable: true,
    })

    const amount0 = parseUnits('100', 6).toString()
    const amount1 = parseUnits('0.04', 18).toString()
    const params = {
      pool: emptyPool,
      amount0,
      amount1,
      recipient: TEST_ADDRESSES.recipient,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify encodeSqrtRatioX96 was called for new pool
    expect(mockEncodeSqrtRatioX96).toHaveBeenCalledWith(amount1, amount0)

    // Verify Position.fromAmounts was called with the empty pool
    expect(mockPositionFromAmounts).toHaveBeenCalledWith({
      pool: emptyPool,
      tickLower: TickMath.MIN_TICK, // nearestUsableTick result
      tickUpper: TickMath.MAX_TICK, // nearestUsableTick result
      amount0,
      amount1,
      useFullPrecision: true,
    })

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockAddCallParameters.mock.calls[0]

    expect((options as AddCallParametersOptions).createPool).toBe(true)
    expect((options as AddCallParametersOptions).sqrtPriceX96).toBe(MOCK_SQRT_PRICE_X96) // encodeSqrtRatioX96 result
  })

  it('should call V4PositionManager.addCallParameters with custom tick bounds when provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    // Use ticks that are valid for the pool's tickSpacing (60)
    const tickLower = CUSTOM_TICK_LOWER // -120 is a multiple of 60
    const tickUpper = CUSTOM_TICK_UPPER // 120 is a multiple of 60
    const params = {
      pool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
      tickLower,
      tickUpper,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify nearestUsableTick was NOT called since custom ticks were provided
    expect(mockNearestUsableTick).not.toHaveBeenCalled()

    // Verify Position.fromAmount0 was called with exact custom tick parameters
    expect(mockPositionFromAmount0).toHaveBeenCalledWith({
      pool,
      tickLower,
      tickUpper,
      amount0,
      useFullPrecision: true,
    })

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [position] = mockAddCallParameters.mock.calls[0]

    expect(position).toBe(mockPosition)
  })

  it('should call V4PositionManager.addCallParameters with custom slippage tolerance when provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    const customSlippage = CUSTOM_SLIPPAGE_BIPS // 5%
    const params = {
      pool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
      slippageTolerance: customSlippage,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify percentFromBips was called with custom slippage
    expect(mockPercentFromBips).toHaveBeenCalledWith(customSlippage)

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockAddCallParameters.mock.calls[0]

    expect(options.slippageTolerance).toEqual(MOCK_SLIPPAGE_PERCENT)
  })

  it('should call V4PositionManager.addCallParameters with custom deadline when provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    const customDeadline = CUSTOM_DEADLINE
    const params = {
      pool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
      deadline: customDeadline,
    }

    await buildAddLiquidityCallData(params, instance)

    // Verify getDefaultDeadline was NOT called since custom deadline was provided
    expect(mockGetDefaultDeadline).not.toHaveBeenCalled()

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockAddCallParameters.mock.calls[0]

    expect(options.deadline).toBe(customDeadline)
  })

  it('should call V4PositionManager.addCallParameters with permit2 batch signature when provided', async () => {
    const amount0 = parseUnits('100', 6).toString()
    const permit2BatchSignature = {
      owner: TEST_ADDRESSES.user,
      permitBatch: {
        details: [
          {
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '100000000',
            expiration: Math.floor(Date.now() / 1000) + 1800,
            nonce: 0,
          },
        ],
        spender: TEST_ADDRESSES.recipient,
        sigDeadline: Math.floor(Date.now() / 1000) + 1800,
      },
      signature: MOCK_SIGNATURE,
    }
    const params = {
      pool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
      permit2BatchSignature,
    }

    await buildAddLiquidityCallData(params, instance)

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockAddCallParameters.mock.calls[0]

    expect(options.batchPermit).toEqual({
      owner: permit2BatchSignature.owner,
      permitBatch: permit2BatchSignature.permitBatch,
      signature: permit2BatchSignature.signature,
    })
  })

  it('should call V4PositionManager.addCallParameters with native currency when pool has native token', async () => {
    // Create a pool with native token (WETH as native)
    const nativePool = createTestPool()
    Object.defineProperty(nativePool.token0, 'isNative', {
      value: true,
      writable: true,
    })

    const amount0 = parseUnits('100', 6).toString()
    const params = {
      pool: nativePool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
    }

    await buildAddLiquidityCallData(params, instance)

    expect(mockAddCallParameters).toHaveBeenCalledTimes(1)
    const [, options] = mockAddCallParameters.mock.calls[0]

    expect(options.useNative).toBe(nativePool.token0)
  })

  it('should throw error when neither amount0 nor amount1 is provided', async () => {
    const params = {
      pool,
      recipient: TEST_ADDRESSES.recipient,
    }

    await expect(buildAddLiquidityCallData(params, instance)).rejects.toThrow(
      'Invalid input: at least one of amount0 or amount1 must be defined.',
    )

    expect(mockAddCallParameters).not.toHaveBeenCalled()
  })

  it('should throw error when creating pool with only one amount', async () => {
    const emptyPool = createTestPool()
    Object.defineProperty(emptyPool, 'liquidity', {
      value: { toString: () => '0' },
      writable: true,
    })

    const amount0 = parseUnits('100', 6).toString()
    const params = {
      pool: emptyPool,
      amount0,
      recipient: TEST_ADDRESSES.recipient,
    }

    await expect(buildAddLiquidityCallData(params, instance)).rejects.toThrow(
      'Both amount0 and amount1 are required when creating a new pool.',
    )

    expect(mockAddCallParameters).not.toHaveBeenCalled()
  })
})
