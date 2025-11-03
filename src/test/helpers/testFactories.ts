import { Token } from '@uniswap/sdk-core'
import { Pool, Position } from '@uniswap/v4-sdk'
import type { Address } from 'viem'

// Common test tokens
export const USDC = new Token(
  1,
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  6,
  'USDC',
  'USD Coin',
)
export const WETH = new Token(
  1,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  18,
  'WETH',
  'Wrapped Ether',
)

// Common test addresses
export const TEST_ADDRESSES = {
  user: '0x1234567890123456789012345678901234567890' as Address,
  recipient: '0x0987654321098765432109876543210987654321' as Address,
  hooks: '0x1111111111111111111111111111111111111111' as Address,
} as const

// Factory functions
export const createTestPool = (currency0 = USDC, currency1 = WETH) =>
  new Pool(
    currency0,
    currency1,
    3000, // fee
    60, // tickSpacing
    TEST_ADDRESSES.hooks,
    '79228162514264337593543950336', // sqrtPriceX96
    '1000000', // liquidity
    0, // tick
  )

export const createTestPosition = (pool = createTestPool()) =>
  new Position({
    pool,
    liquidity: '1000000',
    tickLower: -60,
    tickUpper: 60,
  })

export const createMockPositionData = (
  pool = createTestPool(),
  position = createTestPosition(pool),
) => {
  // Extract currencies from pool
  const currency0 = pool.currency0
  const currency1 = pool.currency1

  return {
    position,
    pool,
    currency0,
    currency1,
    poolId: TEST_ADDRESSES.hooks,
    tokenId: '1',
    currentTick: 0, // Mock current tick (matching the test pool's tick parameter)
  }
}
