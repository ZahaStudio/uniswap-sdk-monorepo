import {
  AllowanceTransfer,
  MaxUint160,
  PERMIT2_ADDRESS,
  type PermitSingle,
} from '@uniswap/permit2-sdk'
import type { TypedDataField } from 'ethers'
import type { Address, Hex } from 'viem'
import { zeroAddress } from 'viem'
import type { UniDevKitV4Instance } from '@/types'
import type { PreparePermit2DataArgs, PreparePermit2DataResult } from '@/types/utils/permit2'

export const allowanceAbi = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [
      {
        components: [
          { name: 'amount', type: 'uint160' },
          { name: 'expiration', type: 'uint48' },
          { name: 'nonce', type: 'uint48' },
        ],
        name: 'details',
        type: 'tuple',
      },
    ],
  },
] as const

/**
 * Prepares the permit2  data for a single token
 *
 * This function creates a permit that allows a spender to use a single token
 * on behalf of the user. It fetches current allowance details for the token and
 * prepares the data needed for signing.
 *
 * The complete flow to use this function is:
 * 1. Prepare the permit data:
 * ```typescript
 * const permitData = await preparePermit2Data({
 *   token: token0,
 *   spender: positionManagerAddress,
 *   owner: userAddress
 * }, instance)
 * ```
 *
 * 2. Sign the permit data using your signer (viem):
 * ```typescript
 * const signature = await signer._signTypedData(permitData.toSign)
 *
 * // ethers
 * const signature = await signer.signTypedData(
 *   permitData.toSign.domain,
 *   permitData.toSign.types,
 *   permitData.toSign.values,
 * )
 * ```
 *
 * 3. Build the final permit data with signature:
 * ```typescript
 * const permitWithSignature = permitData.buildPermit2DataWithSignature(signature)
 * ```
 *
 * 4. Use the permit in your transaction (e.g. with buildAddLiquidityCallData):
 * ```typescript
 * const { calldata } = await buildAddLiquidityCallData({
 *   permit2Signature: permitWithSignature,
 *   // ... other params
 * }, instance)
 * ```
 *
 * @param params - Parameters for preparing the permit2 batch data
 * @returns Promise resolving to the permit2 batch data and helper functions
 * @throws Error if any required dependencies are missing
 */
export async function preparePermit2Data(
  params: PreparePermit2DataArgs,
  instance: UniDevKitV4Instance,
): Promise<PreparePermit2DataResult> {
  const { token, spender, owner, sigDeadline: sigDeadlineParam } = params
  const chainId = instance.chain.id

  if (token.toLowerCase() === zeroAddress.toLowerCase()) {
    throw new Error('Native tokens are not supported for permit2')
  }

  // calculate sigDeadline if not provided
  let sigDeadline = sigDeadlineParam
  if (!sigDeadline) {
    const blockTimestamp = await instance.client.getBlock().then((block) => block.timestamp)
    sigDeadline = Number(blockTimestamp + 60n * 60n) // 30 minutes from current block timestamp
  }

  // Fetch allowance details for each token
  const details = await instance.client.readContract({
    address: PERMIT2_ADDRESS as `0x${string}`,
    abi: allowanceAbi,
    functionName: 'allowance',
    args: [owner as `0x${string}`, token as `0x${string}`, spender as `0x${string}`],
  })

  const permit: PermitSingle = {
    details: {
      token,
      amount: MaxUint160.toString(),
      expiration: details.expiration.toString(),
      nonce: details.nonce.toString(),
    },
    spender,
    sigDeadline,
  }

  // Create the permit object
  // Get the data needed for signing
  const { domain, types, values } = AllowanceTransfer.getPermitData(
    permit,
    PERMIT2_ADDRESS,
    chainId,
  ) as {
    domain: PreparePermit2DataResult['toSign']['domain']
    types: Record<string, TypedDataField[]>
    values: PermitSingle
  }

  const buildPermit2DataWithSignature = (
    signature: Hex,
  ): ReturnType<PreparePermit2DataResult['buildPermit2DataWithSignature']> => {
    return {
      owner: owner as Address,
      permit,
      signature,
    }
  }

  return {
    buildPermit2DataWithSignature,
    owner,
    permit,
    toSign: {
      domain,
      types,
      values,
      primaryType: 'PermitSingle',
      message: values as unknown as Record<string, unknown>,
    },
  }
}
