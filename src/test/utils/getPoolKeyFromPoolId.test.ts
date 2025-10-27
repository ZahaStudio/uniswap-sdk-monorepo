import { describe, expect, it, vi } from 'vitest'
import { createMockSdkInstance } from '@/test/helpers/sdkInstance'
import { getPoolKeyFromPoolId } from '@/utils/getPoolKeyFromPoolId'

describe('getPoolKeyFromPoolId', () => {
  it('should throw error if SDK instance not found', async () => {
    const mockDeps = createMockSdkInstance()
    mockDeps.client.readContract = vi.fn().mockRejectedValueOnce(new Error('SDK not initialized'))

    await expect(getPoolKeyFromPoolId('0x123', mockDeps)).rejects.toThrow('SDK not initialized')
  })

  it('should return pool key when SDK instance exists', async () => {
    const mockPoolKey = [
      '0x123', // currency0
      '0x456', // currency1
      3000, // fee
      60, // tickSpacing
      '0x789', // hooks
    ]

    const mockDeps = createMockSdkInstance()
    mockDeps.client.readContract = vi.fn().mockResolvedValueOnce(mockPoolKey)

    const result = await getPoolKeyFromPoolId('0x123', mockDeps)

    expect(result).toEqual({
      currency0: '0x123',
      currency1: '0x456',
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x789',
    })
    expect(mockDeps.client.readContract).toHaveBeenCalledWith({
      address: mockDeps.contracts.positionManager,
      abi: expect.any(Object),
      functionName: 'poolKeys',
      args: ['0x123'],
    })
  })

  it('should handle contract read errors', async () => {
    const mockDeps = createMockSdkInstance()
    mockDeps.client.readContract = vi.fn().mockRejectedValueOnce(new Error('Contract read failed'))

    await expect(getPoolKeyFromPoolId('0x123', mockDeps)).rejects.toThrow('Contract read failed')
  })
})
