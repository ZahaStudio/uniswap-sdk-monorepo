import { AllowanceTransfer, MaxUint160, PERMIT2_ADDRESS, type PermitBatch } from "@uniswap/permit2-sdk";
import type { BatchPermitOptions } from "@uniswap/v4-sdk";
import type { Hex } from "viem";
import { zeroAddress } from "viem";

import type { TypedDataField } from "@/types/utils/permit2";

 /**
 * Prepares the permit2 batch data for multiple tokens
 *
 * This function creates a batch permit that allows a spender to use multiple tokens
 * on behalf of the user. It fetches current allowance details for each token and
 * prepares the data needed for signing. You can use with viem or ethers.
 *
 * The complete flow to use this function is:
 * 1. Prepare the permit data:
 * ```typescript
 * const permitData = await preparePermit2BatchData({
 *   tokens: [currency0, currency1],
 *   spender: positionManagerAddress,
 *   owner: userAddress
 * }, instance)
 * ```
 *
 * 2. Sign the permit data using your signer:
 * ```typescript
 * // viem
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
 * const permitWithSignature = permitData.buildPermit2BatchDataWithSignature(signature)
 * ```
 *
 * 4. Use the permit in your transaction (e.g. with buildAddLiquidityCallData):
 * ```typescript
 * const { calldata } = await buildAddLiquidityCallData({
 *   permit2BatchSignature: permitWithSignature,
 *   // ... other params
 * }, instance)
 * ```
 *
 * @param params - Parameters for preparing the permit2 batch data
 * @returns Promise resolving to the permit2 batch data and helper functions
 * @throws Error if any required dependencies are missing
 */
import type { UniDevKitV4Instance } from "@/types";
import type { PreparePermit2BatchDataArgs, PreparePermit2BatchDataResult } from "@/types/utils/permit2";
export async function preparePermit2BatchData(
  params: PreparePermit2BatchDataArgs,
  instance: UniDevKitV4Instance,
): Promise<PreparePermit2BatchDataResult> {
  const { tokens, spender, owner, sigDeadline: sigDeadlineParam } = params;

  const chainId = instance.chain.id;

  // calculate sigDeadline if not provided
  let sigDeadline = sigDeadlineParam;
  if (!sigDeadline) {
    const blockTimestamp = await instance.client.getBlock().then((block) => block.timestamp);

    sigDeadline = Number(blockTimestamp + 60n * 60n); // 30 minutes from current block timestamp
  }

  const noNativeTokens = tokens.filter((token) => token.toLowerCase() !== zeroAddress.toLowerCase());

  // Fetch allowance details for each token
  const details = await instance.client.multicall({
    allowFailure: false,
    contracts: noNativeTokens.map((token) => ({
      address: PERMIT2_ADDRESS as `0x${string}`,
      abi: [
        {
          name: "allowance",
          type: "function",
          stateMutability: "view",
          inputs: [
            { name: "owner", type: "address" },
            { name: "token", type: "address" },
            { name: "spender", type: "address" },
          ],
          outputs: [
            {
              components: [
                { name: "amount", type: "uint160" },
                { name: "expiration", type: "uint48" },
                { name: "nonce", type: "uint48" },
              ],
              name: "details",
              type: "tuple",
            },
          ],
        },
      ] as const,
      functionName: "allowance",
      args: [owner, token, spender],
    })),
  });

  const results = noNativeTokens.map((token, index) => {
    const { expiration, nonce } = details[index];
    return {
      token,
      amount: MaxUint160.toString(),
      expiration: Number(expiration),
      nonce: Number(nonce),
    };
  });

  // Create the permit batch object
  const permitBatch = {
    details: results,
    spender,
    sigDeadline,
  };

  // Get the data needed for signing
  const { domain, types, values } = AllowanceTransfer.getPermitData(permitBatch, PERMIT2_ADDRESS, chainId) as {
    domain: PreparePermit2BatchDataResult["toSign"]["domain"];
    types: Record<string, TypedDataField[]>;
    values: PermitBatch;
  };

  const buildPermit2BatchDataWithSignature = (signature: string | Hex): BatchPermitOptions => {
    return {
      owner,
      permitBatch,
      signature,
    };
  };

  return {
    buildPermit2BatchDataWithSignature,
    owner,
    permitBatch,
    toSign: {
      domain,
      types,
      values,
      primaryType: "PermitBatch",
      message: values as unknown as Record<string, unknown>,
    },
  };
}
