// Mock V4Planner
vi.mock('@uniswap/v4-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uniswap/v4-sdk')>()
  return {
    ...actual,
    V4Planner: vi.fn().mockImplementation(() => ({
      addAction: vi.fn(),
      addSettle: vi.fn(),
      addTake: vi.fn(),
      actions: '0x1234567890abcdef',
      params: ['0xabcdef1234567890'],
    })),
  }
})

// Mock ethers
vi.mock('ethers', () => ({
  ethers: {
    utils: {
      defaultAbiCoder: {
        encode: vi.fn().mockReturnValue('0xencoded'),
      },
      solidityPack: vi.fn().mockReturnValue('0xpacked'),
      Interface: vi.fn().mockImplementation(() => ({
        encodeFunctionData: vi.fn().mockReturnValue('0x1234567890abcdef'),
      })),
    },
  },
}))

import { Actions, V4Planner } from '@uniswap/v4-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestPool, TEST_ADDRESSES } from '@/test/helpers/testFactories'
import { buildSwapCallData } from '@/utils/buildSwapCallData'
import { COMMANDS } from '@/types/utils/buildSwapCallData'
import { ethers } from 'ethers'

// Test constants
const MOCK_AMOUNT_IN = BigInt(1000000) // 1 USDC
const MOCK_AMOUNT_OUT_MINIMUM = BigInt(950000000000000000) // 0.95 WETH
const MOCK_PERMIT_SIGNATURE = '0x1234567890abcdef' as const
const MOCK_PERMIT = {
  details: {
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as const,
    amount: BigInt(1000000),
    expiration: Math.floor(Date.now() / 1000) + 1800,
    nonce: 0,
  },
  spender: TEST_ADDRESSES.recipient,
  sigDeadline: Math.floor(Date.now() / 1000) + 1800,
}
const MOCK_CUSTOM_ACTION = {
  action: Actions.SWAP_EXACT_IN_SINGLE,
  parameters: [{ poolKey: '0x123', amountIn: '1000000' }],
}

// Mock planner type for testing
type MockPlanner = {
  addAction: ReturnType<typeof vi.fn>
  addSettle: ReturnType<typeof vi.fn>
  addTake: ReturnType<typeof vi.fn>
  actions: string
  params: string[]
}

describe('buildSwapCallData', () => {
  const mockPool = createTestPool()
  let mockPlanner: MockPlanner

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset V4Planner mock
    mockPlanner = {
      addAction: vi.fn(),
      addSettle: vi.fn(),
      addTake: vi.fn(),
      actions: '0x1234567890abcdef',
      params: ['0xabcdef1234567890'],
    }

    vi.mocked(V4Planner).mockImplementation(() => mockPlanner as unknown as V4Planner)
  })

  it('should build calldata with default actions', () => {
    const testCases = [{ zeroForOne: true }, { zeroForOne: false }]

    testCases.forEach(({ zeroForOne }) => {
      vi.clearAllMocks()
      mockPlanner = {
        addAction: vi.fn(),
        addSettle: vi.fn(),
        addTake: vi.fn(),
        actions: '0x1234567890abcdef',
        params: ['0xabcdef1234567890'],
      }
      vi.mocked(V4Planner).mockImplementation(() => mockPlanner as unknown as V4Planner)

      const params = {
        amountIn: MOCK_AMOUNT_IN,
        amountOutMinimum: MOCK_AMOUNT_OUT_MINIMUM,
        pool: mockPool,
        zeroForOne,
        recipient: TEST_ADDRESSES.recipient,
      }

      buildSwapCallData(params)

      // Verify V4Planner was instantiated
      expect(V4Planner).toHaveBeenCalledTimes(1)

      // Verify default actions were added
      expect(mockPlanner.addAction).toHaveBeenCalledWith(Actions.SWAP_EXACT_IN_SINGLE, [
        {
          poolKey: mockPool.poolKey,
          zeroForOne,
          amountIn: MOCK_AMOUNT_IN.toString(),
          amountOutMinimum: MOCK_AMOUNT_OUT_MINIMUM.toString(),
          hookData: '0x',
        },
      ])

      // Verify settle and take actions based on zeroForOne
      const expectedSettleCurrency = zeroForOne ? mockPool.currency0 : mockPool.currency1
      const expectedTakeCurrency = zeroForOne ? mockPool.currency1 : mockPool.currency0
      expect(mockPlanner.addSettle).toHaveBeenCalledWith(expectedSettleCurrency, true)
      expect(mockPlanner.addTake).toHaveBeenCalledWith(
        expectedTakeCurrency,
        TEST_ADDRESSES.recipient,
      )

      // Verify ethers.utils.Interface was called with correct ABI
      const mockInterface = vi.mocked(ethers.utils.Interface)
      const mockInterfaceInstance = mockInterface.mock.results[0].value
      expect(mockInterface).toHaveBeenCalledWith([
        'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
      ])

      // Verify encodeFunctionData was called with correct parameters
      expect(mockInterfaceInstance.encodeFunctionData).toHaveBeenCalledWith('execute', [
        '0xpacked',
        ['0xencoded'],
        expect.any(BigInt),
      ])
    })
  })

  it('should build calldata with custom actions', () => {
    const testCases = [
      {
        customActions: [MOCK_CUSTOM_ACTION],
      },
      {
        customActions: [
          MOCK_CUSTOM_ACTION,
          {
            action: Actions.SWAP_EXACT_IN_SINGLE,
            parameters: [{ poolKey: '0x456', amountIn: '2000000' }],
          },
        ],
      },
    ]

    testCases.forEach(({ customActions }) => {
      vi.clearAllMocks()
      mockPlanner = {
        addAction: vi.fn(),
        addSettle: vi.fn(),
        addTake: vi.fn(),
        actions: '0x1234567890abcdef',
        params: ['0xabcdef1234567890'],
      }
      vi.mocked(V4Planner).mockImplementation(() => mockPlanner as unknown as V4Planner)

      const params = {
        amountIn: MOCK_AMOUNT_IN,
        amountOutMinimum: MOCK_AMOUNT_OUT_MINIMUM,
        pool: mockPool,
        zeroForOne: true,
        recipient: TEST_ADDRESSES.recipient,
        customActions,
      }

      buildSwapCallData(params)

      // Verify custom actions were added
      expect(mockPlanner.addAction).toHaveBeenCalledTimes(customActions.length)
      expect(mockPlanner.addAction).toHaveBeenNthCalledWith(
        1,
        MOCK_CUSTOM_ACTION.action,
        MOCK_CUSTOM_ACTION.parameters,
      )

      // Verify default actions were NOT called
      expect(mockPlanner.addSettle).not.toHaveBeenCalled()
      expect(mockPlanner.addTake).not.toHaveBeenCalled()

      // Verify ethers.utils.Interface was called with correct ABI
      const mockInterface = vi.mocked(ethers.utils.Interface)
      const mockInterfaceInstance = mockInterface.mock.results[0].value
      expect(mockInterface).toHaveBeenCalledWith([
        'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
      ])

      // Verify encodeFunctionData was called with correct parameters
      expect(mockInterfaceInstance.encodeFunctionData).toHaveBeenCalledWith('execute', [
        '0xpacked',
        ['0xencoded'],
        expect.any(BigInt),
      ])
    })
  })

  it('should handle permit2 signature correctly', () => {
    const testCases = [
      {
        permit2Signature: undefined,
        expectedCommands: [COMMANDS.V4_SWAP],
      },
      {
        permit2Signature: {
          signature: MOCK_PERMIT_SIGNATURE,
          owner: TEST_ADDRESSES.user,
          permit: MOCK_PERMIT,
        },
        expectedCommands: [COMMANDS.PERMIT2_PERMIT, COMMANDS.V4_SWAP],
      },
    ]

    testCases.forEach(({ permit2Signature }) => {
      vi.clearAllMocks()
      mockPlanner = {
        addAction: vi.fn(),
        addSettle: vi.fn(),
        addTake: vi.fn(),
        actions: '0x1234567890abcdef',
        params: ['0xabcdef1234567890'],
      }
      vi.mocked(V4Planner).mockImplementation(() => mockPlanner as unknown as V4Planner)

      const params = {
        amountIn: MOCK_AMOUNT_IN,
        amountOutMinimum: MOCK_AMOUNT_OUT_MINIMUM,
        pool: mockPool,
        zeroForOne: true,
        recipient: TEST_ADDRESSES.recipient,
        ...(permit2Signature && { permit2Signature }),
      }

      buildSwapCallData(params)

      // Verify solidityPack was called with correct parameters based on permit2Signature
      if (permit2Signature) {
        expect(ethers.utils.solidityPack).toHaveBeenCalledWith(
          ['uint8', 'uint8'],
          [COMMANDS.PERMIT2_PERMIT, COMMANDS.V4_SWAP],
        )
      } else {
        expect(ethers.utils.solidityPack).toHaveBeenCalledWith(['uint8'], [COMMANDS.V4_SWAP])
      }

      // Verify defaultAbiCoder.encode was called with correct parameters
      if (permit2Signature) {
        // Should be called 3 times: once for initial planner, once for permit2 struct, once for final planner
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenCalledTimes(3)
        // First call: initial planner actions and params
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenNthCalledWith(
          1,
          ['bytes', 'bytes[]'],
          expect.any(Array),
        )
        // Second call: permit2 struct input (inside buildPermit2StructInput)
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenNthCalledWith(
          2,
          [
            'tuple(' +
              'tuple(address token,uint160 amount,uint48 expiration,uint48 nonce) details,' +
              'address spender,' +
              'uint256 sigDeadline' +
              ')',
            'bytes',
          ],
          [permit2Signature.permit, permit2Signature.signature],
        )
        // Third call: final planner actions and params
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenNthCalledWith(
          3,
          ['bytes', 'bytes[]'],
          expect.any(Array),
        )
      } else {
        // Should be called once: only for planner
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenCalledTimes(1)
        expect(ethers.utils.defaultAbiCoder.encode).toHaveBeenCalledWith(
          ['bytes', 'bytes[]'],
          expect.any(Array),
        )
      }

      // Verify ethers.utils.Interface was called with correct ABI
      const mockInterface = vi.mocked(ethers.utils.Interface)
      const mockInterfaceInstance = mockInterface.mock.results[0].value
      expect(mockInterface).toHaveBeenCalledWith([
        'function execute(bytes commands, bytes[] inputs, uint256 deadline)',
      ])

      // Verify encodeFunctionData was called with correct parameters
      const expectedInputs = permit2Signature ? ['0xencoded', '0xencoded'] : ['0xencoded']
      expect(mockInterfaceInstance.encodeFunctionData).toHaveBeenCalledWith('execute', [
        '0xpacked',
        expectedInputs,
        expect.any(BigInt),
      ])
    })
  })
})
