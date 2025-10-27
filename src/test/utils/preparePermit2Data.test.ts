import { PERMIT2_ADDRESS, AllowanceTransfer } from '@uniswap/permit2-sdk'
import { type Block, zeroAddress } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { preparePermit2Data } from '../../utils/preparePermit2Data'

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

describe('preparePermit2Data', () => {
  const mockInstance = createMockSdkInstance()
  const mockBlockTimestamp = 1234567890n
  const mockAllowance = {
    amount: '1000000',
    expiration: '1234567890',
    nonce: '42',
  }

  const mockParams = {
    token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    spender: '0x1234567890123456789012345678901234567890',
    owner: '0x0987654321098765432109876543210987654321',
  }

  const mockGetPermitData = vi.mocked(AllowanceTransfer.getPermitData)

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock client methods
    vi.spyOn(mockInstance.client, 'readContract').mockImplementation(async () => mockAllowance)
    vi.spyOn(mockInstance.client, 'getBlock').mockResolvedValue({
      timestamp: mockBlockTimestamp,
    } as Block)

    // Mock getPermitData
    mockGetPermitData.mockReturnValue({
      domain: { name: 'Permit2', version: '1', chainId: 1, verifyingContract: PERMIT2_ADDRESS },
      types: { PermitSingle: [] },
      values: mockParams,
    } as unknown as ReturnType<typeof AllowanceTransfer.getPermitData>)
  })

  it('should throw error for native token', async () => {
    await expect(
      preparePermit2Data(
        {
          ...mockParams,
          token: zeroAddress,
        },
        mockInstance,
      ),
    ).rejects.toThrow('Native tokens are not supported for permit2')
  })

  it('should call client.readContract with correct parameters', async () => {
    await preparePermit2Data(mockParams, mockInstance)

    expect(mockInstance.client.readContract).toHaveBeenCalledWith({
      address: PERMIT2_ADDRESS,
      abi: expect.any(Array),
      functionName: 'allowance',
      args: [mockParams.owner, mockParams.token, mockParams.spender],
    })
  })

  it('should call AllowanceTransfer.getPermitData with correct parameters', async () => {
    await preparePermit2Data(mockParams, mockInstance)

    expect(mockGetPermitData).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          token: mockParams.token,
          amount: expect.any(String),
          expiration: mockAllowance.expiration,
          nonce: mockAllowance.nonce,
        }),
        spender: mockParams.spender,
        sigDeadline: expect.any(Number),
      }),
      PERMIT2_ADDRESS,
      mockInstance.chain.id,
    )
  })

  it('should call client.getBlock and use block timestamp for sigDeadline when not provided', async () => {
    const result = await preparePermit2Data(mockParams, mockInstance)

    expect(mockInstance.client.getBlock).toHaveBeenCalledWith()
    expect(result.permit.sigDeadline).toBe(Number(mockBlockTimestamp) + 3600)
  })

  it('should not call client.getBlock when sigDeadline is provided', async () => {
    const customDeadline = 1234567890
    const result = await preparePermit2Data(
      {
        ...mockParams,
        sigDeadline: customDeadline,
      },
      mockInstance,
    )

    expect(mockInstance.client.getBlock).not.toHaveBeenCalled()
    expect(result.permit.sigDeadline).toBe(customDeadline)
  })

  it('should return correct result structure', async () => {
    const result = await preparePermit2Data(mockParams, mockInstance)

    expect(result.owner).toBe(mockParams.owner)
    expect(result.permit.details.token).toBe(mockParams.token)
    expect(result.permit.spender).toBe(mockParams.spender)
    expect(result.permit.sigDeadline).toBe(Number(mockBlockTimestamp) + 3600)
    expect(result.toSign.domain).toBeDefined()
    expect(result.toSign.types).toBeDefined()
    expect(result.toSign.values).toBeDefined()
    expect(result.buildPermit2DataWithSignature).toBeDefined()
  })

  it('should build permit2 data with signature correctly', async () => {
    const result = await preparePermit2Data(mockParams, mockInstance)
    const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
    const permitWithSignature = result.buildPermit2DataWithSignature(signature)

    expect(permitWithSignature).toEqual({
      owner: mockParams.owner,
      permit: result.permit,
      signature,
    })
  })
})
