import { PERMIT2_ADDRESS, AllowanceTransfer } from '@uniswap/permit2-sdk'
import { type Block, zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { preparePermit2BatchData } from '@/utils/preparePermit2BatchData'

// Mock AllowanceTransfer.getPermitData
vi.mock('@uniswap/permit2-sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uniswap/permit2-sdk')>()
  return {
    ...actual,
    AllowanceTransfer: {
      ...actual.AllowanceTransfer,
      getPermitData: vi.fn(),
    },
  }
})

describe('preparePermit2BatchData', () => {
  const mockInstance = createMockSdkInstance()
  const mockBlockTimestamp = 1234567890n
  const mockMulticallResponse = [
    {
      amount: 0n,
      expiration: 1234567890n,
      nonce: 42n,
    },
    {
      amount: 0n,
      expiration: 1234567890n,
      nonce: 43n,
    },
  ]

  const mockParams = {
    tokens: [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    ],
    spender: '0x1234567890123456789012345678901234567890',
    owner: '0x0987654321098765432109876543210987654321',
  }

  const mockGetPermitData = vi.mocked(AllowanceTransfer.getPermitData)

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock client methods
    vi.spyOn(mockInstance.client, 'multicall').mockImplementation(async () => mockMulticallResponse)
    vi.spyOn(mockInstance.client, 'getBlock').mockResolvedValue({
      timestamp: mockBlockTimestamp,
    } as Block)

    // Mock getPermitData
    mockGetPermitData.mockReturnValue({
      domain: { name: 'Permit2', version: '1', chainId: 1, verifyingContract: PERMIT2_ADDRESS },
      types: { PermitBatch: [] },
      values: mockParams,
    } as unknown as ReturnType<typeof AllowanceTransfer.getPermitData>)
  })

  it('should call client.multicall with correct parameters', async () => {
    await preparePermit2BatchData(mockParams, mockInstance)

    expect(mockInstance.client.multicall).toHaveBeenCalledWith({
      allowFailure: false,
      contracts: expect.arrayContaining([
        expect.objectContaining({
          address: PERMIT2_ADDRESS,
          abi: expect.any(Array),
          functionName: 'allowance',
          args: [mockParams.owner, mockParams.tokens[0], mockParams.spender],
        }),
        expect.objectContaining({
          address: PERMIT2_ADDRESS,
          abi: expect.any(Array),
          functionName: 'allowance',
          args: [mockParams.owner, mockParams.tokens[1], mockParams.spender],
        }),
      ]),
    })
  })

  it('should call AllowanceTransfer.getPermitData with correct parameters', async () => {
    await preparePermit2BatchData(mockParams, mockInstance)

    expect(mockGetPermitData).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.arrayContaining([
          expect.objectContaining({
            token: mockParams.tokens[0],
            amount: expect.any(String),
            expiration: Number(mockMulticallResponse[0].expiration),
            nonce: Number(mockMulticallResponse[0].nonce),
          }),
          expect.objectContaining({
            token: mockParams.tokens[1],
            amount: expect.any(String),
            expiration: Number(mockMulticallResponse[1].expiration),
            nonce: Number(mockMulticallResponse[1].nonce),
          }),
        ]),
        spender: mockParams.spender,
        sigDeadline: expect.any(Number),
      }),
      PERMIT2_ADDRESS,
      mockInstance.chain.id,
    )
  })

  it('should call client.getBlock and use block timestamp for sigDeadline when not provided', async () => {
    const result = await preparePermit2BatchData(mockParams, mockInstance)

    expect(mockInstance.client.getBlock).toHaveBeenCalledWith()
    expect(result.permitBatch.sigDeadline).toBe(Number(mockBlockTimestamp) + 3600)
  })

  it('should not call client.getBlock when sigDeadline is provided', async () => {
    const customDeadline = 1234567890
    const result = await preparePermit2BatchData(
      {
        ...mockParams,
        sigDeadline: customDeadline,
      },
      mockInstance,
    )

    expect(mockInstance.client.getBlock).not.toHaveBeenCalled()
    expect(result.permitBatch.sigDeadline).toBe(customDeadline)
  })

  it('should filter out native tokens from multicall', async () => {
    const paramsWithNative = {
      tokens: [
        zeroAddress, // Native token
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      ],
      spender: mockParams.spender,
      owner: mockParams.owner,
    }

    await preparePermit2BatchData(paramsWithNative, mockInstance)

    // Should only call multicall for non-native tokens
    expect(mockInstance.client.multicall).toHaveBeenCalledWith({
      allowFailure: false,
      contracts: expect.arrayContaining([
        expect.objectContaining({
          args: [
            mockParams.owner,
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            mockParams.spender,
          ],
        }),
      ]),
    })
  })

  it('should return correct result structure', async () => {
    const result = await preparePermit2BatchData(mockParams, mockInstance)

    expect(result.owner).toBe(mockParams.owner)
    expect(result.permitBatch.spender).toBe(mockParams.spender)
    expect(result.permitBatch.details).toHaveLength(2)
    expect(result.permitBatch.sigDeadline).toBe(Number(mockBlockTimestamp) + 3600)
    expect(result.toSign.domain).toBeDefined()
    expect(result.toSign.types).toBeDefined()
    expect(result.toSign.values).toBeDefined()
    expect(result.buildPermit2BatchDataWithSignature).toBeDefined()
  })

  it('should build permit2 batch data with signature correctly', async () => {
    const result = await preparePermit2BatchData(mockParams, mockInstance)
    const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const permitWithSignature = result.buildPermit2BatchDataWithSignature(signature)

    expect(permitWithSignature).toEqual({
      owner: mockParams.owner,
      permitBatch: result.permitBatch,
      signature,
    })
  })
})
