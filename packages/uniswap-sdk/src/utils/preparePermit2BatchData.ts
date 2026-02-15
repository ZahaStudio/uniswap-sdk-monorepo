import { AllowanceTransfer, MaxUint160, type PermitBatch } from "@uniswap/permit2-sdk";
import type { BatchPermitOptions } from "@uniswap/v4-sdk";
import type { Hex } from "viem";
import { zeroAddress } from "viem";

import type { UniswapSDKInstance } from "@/core/sdk";
import { getDefaultDeadline } from "@/utils/getDefaultDeadline";
import {
  type TypedDataField,
  type PreparePermit2BatchDataArgs,
  type PreparePermit2BatchDataResult,
  allowanceAbi,
} from "@/utils/preparePermit2Data";

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
 * const signature = await walletClient.signTypedData({
 *   domain: permitData.toSign.domain,
 *   types: permitData.toSign.types,
 *   primaryType: permitData.toSign.primaryType,
 *   message: permitData.toSign.message,
 * })
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
export async function preparePermit2BatchData(
  params: PreparePermit2BatchDataArgs,
  instance: UniswapSDKInstance,
): Promise<PreparePermit2BatchDataResult> {
  const { tokens, spender, owner, deadlineDuration } = params;

  const sigDeadline = await getDefaultDeadline(instance, deadlineDuration);
  const noNativeTokens = tokens.filter((token) => token.toLowerCase() !== zeroAddress.toLowerCase());

  // Fetch allowance details for each token
  const details = await instance.client.multicall({
    allowFailure: false,
    contracts: noNativeTokens.map((token) => ({
      address: instance.contracts.permit2,
      abi: allowanceAbi,
      functionName: "allowance",
      args: [owner, token, spender],
    })),
  });

  const results = noNativeTokens.map((token, index) => {
    const { nonce } = details[index];
    return {
      token,
      amount: MaxUint160.toString(),
      expiration: sigDeadline.toString(),
      nonce: nonce.toString(),
    };
  });

  // Create the permit batch object
  const permitBatch = {
    details: results,
    spender,
    sigDeadline: sigDeadline.toString(),
  };

  // Get the data needed for signing
  const { domain, types, values } = AllowanceTransfer.getPermitData(
    permitBatch,
    instance.contracts.permit2,
    instance.chain.id,
  ) as {
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
