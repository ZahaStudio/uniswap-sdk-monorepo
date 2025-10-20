import { beforeEach, describe, expect, it } from 'vitest'
import { UniDevKitV4 } from '@/core/uniDevKitV4'
import type { UniDevKitV4Config } from '@/types/core'

describe('UniDevKitV4', () => {
  let config: UniDevKitV4Config
  let sdk: UniDevKitV4

  beforeEach(() => {
    config = {
      chainId: 1,
      rpcUrl: 'https://eth.llamarpc.com',
      contracts: {
        poolManager: '0x1234567890123456789012345678901234567890',
        positionDescriptor: '0x1234567890123456789012345678901234567890',
        positionManager: '0x1234567890123456789012345678901234567890',
        quoter: '0x1234567890123456789012345678901234567890',
        stateView: '0x1234567890123456789012345678901234567890',
        universalRouter: '0x1234567890123456789012345678901234567890',
      },
    }
    sdk = new UniDevKitV4(config)
  })

  it('should get contract address', () => {
    expect(sdk.getContractAddress('quoter')).toBe(config.contracts.quoter)
  })

  it('should throw error for non-existent contract', () => {
    // @ts-expect-error Testing invalid contract name
    expect(() => sdk.getContractAddress('invalid')).toThrow()
  })

  it('should update config', () => {
    const newConfig: UniDevKitV4Config = {
      ...config,
      chainId: 8453,
      rpcUrl: 'https://base-rpc.com',
    }
    sdk = new UniDevKitV4(newConfig)
  })
})
