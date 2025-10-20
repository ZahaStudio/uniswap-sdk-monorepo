import type { PermitBatch, PermitSingle } from '@uniswap/permit2-sdk'
import type { BatchPermitOptions } from '@uniswap/v4-sdk'
import type { TypedDataField } from 'ethers'
import type { Address, Hex } from 'viem'

/**
 * Base interface for Permit2 data
 */
interface BasePermit2Data {
  /** Address that will be allowed to spend the tokens */
  spender: Address | string
  /** User's wallet address */
  owner: Address | string
  /** Signature deadline in seconds */
  sigDeadline?: number
}

/**
 * Interface for the arguments required to generate a Permit2 batch signature
 */
export interface PreparePermit2BatchDataArgs extends BasePermit2Data {
  /** Array of token addresses to permit */
  tokens: (Address | string)[]
}

/**
 * Interface for the arguments required to generate a single Permit2 signature
 */
export interface PreparePermit2DataArgs extends BasePermit2Data {
  /** Token address to permit */
  token: Address | string
}

/**
 * Base interface for Permit2 data result
 */
interface BasePermit2DataResult {
  /** User's wallet address */
  owner: Address | string
  /** Data needed to sign the permit2 data */
  toSign: {
    /** Domain of the permit2 data */
    domain: {
      name: string
      version: string
      chainId: number
      verifyingContract: `0x${string}`
    }
    /** Types of the permit2 data */
    types: Record<string, TypedDataField[]>
    /** Values of the permit2 data */
    values: PermitBatch | PermitSingle
    /** Primary type of the permit2 data */
    primaryType: 'PermitBatch' | 'PermitSingle'
    /** Message of the permit2 data */
    message: Record<string, unknown>
  }
}

/**
 * Interface for the return value of the batch permit function
 */
export interface PreparePermit2BatchDataResult extends BasePermit2DataResult {
  /** Function to build the permit2 batch data with a signature */
  buildPermit2BatchDataWithSignature: (signature: string | Hex) => BatchPermitOptions
  /** Permit2 batch data */
  permitBatch: PermitBatch
}

/**
 * Interface for the return value of the single permit function
 */
export interface PreparePermit2DataResult extends BasePermit2DataResult {
  /** Function to build the permit2 data with a signature */
  buildPermit2DataWithSignature: (signature: Hex) => {
    owner: Address
    permit: PermitSingle
    signature: Hex
  }
  /** Permit2 data */
  permit: PermitSingle
}
