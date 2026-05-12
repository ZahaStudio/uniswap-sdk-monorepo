"use client";

import { useCallback } from "react";

import type { WalletBatchCall } from "@zahastudio/uniswap-sdk";
import type { Address } from "viem";

import { erc20Abi, encodeFunctionData, maxUint256, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";

import type { UseHookOptions } from "@/types/hooks";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { assertWalletConnected } from "@/utils/assertions";

/**
 * Operation parameters for the token approval hook.
 */
export interface UseTokenApprovalParams {
  /** ERC-20 token address to approve */
  token: Address;
  /** Spender address (e.g. Permit2 contract) */
  spender: Address;
  /** Required allowance amount — used to determine if approval is needed */
  amount: bigint;
}

/**
 * Configuration options for the token approval hook.
 */
export interface UseTokenApprovalOptions extends UseHookOptions {
  /** Override the owner address (defaults to connected wallet) */
  owner?: Address;
}

/**
 * Return type for the useTokenApproval hook.
 */
export interface UseTokenApprovalReturn {
  /** Wagmi useReadContract result for the allowance query — `.data`, `.isLoading`, `.refetch`, etc. */
  allowance: ReturnType<typeof useReadContract<typeof erc20Abi, "allowance", [Address, Address]>>;
  /**
   * Whether approval is required.
   * - `undefined` — still checking on-chain allowance
   * - `false` — native token, or current allowance ≥ required amount
   * - `true` — approval transaction needed
   */
  isRequired: boolean | undefined;
  /** The useTransaction instance managing the approval tx lifecycle */
  transaction: UseTransactionReturn;
  /** Build the ERC-20 approval call without submitting it. */
  buildApproveCall: (amount?: bigint) => WalletBatchCall;
  /**
   * Send and confirm an approval transaction.
   * @param amount - Amount to approve (defaults to maxUint256 for unlimited approval)
   * @returns The confirmed transaction hash
   */
  approve: (amount?: bigint) => Promise<`0x${string}`>;
}

/**
 * Reusable hook for checking and executing ERC-20 token approvals.
 *
 * Uses `useReadContract` (wagmi's typed `useQuery` wrapper) to check the
 * current on-chain allowance, and `useTransaction` to manage the approval
 * transaction lifecycle. After a successful approval, the allowance query
 * is automatically refetched.
 *
 * Automatically detects native tokens (zero address) and short-circuits —
 * no queries are made and `isRequired` returns `false`.
 *
 * @param params - Operation parameters: token, spender, amount
 * @param options - Configuration: owner override, enabled, chainId
 * @returns Allowance state, approval status, and execute function
 *
 * @example
 * ```tsx
 * const approval = useTokenApproval(
 *   { token: usdcAddress, spender: PERMIT2_ADDRESS, amount: parseUnits("100", 6) },
 *   { chainId: 1 },
 * );
 *
 * if (approval.isRequired) await approval.approve(); // waits for confirmation
 * ```
 */
export function useTokenApproval(
  params: UseTokenApprovalParams,
  options: UseTokenApprovalOptions = {},
): UseTokenApprovalReturn {
  const { token, spender, amount } = params;
  const { owner: ownerOverride, enabled = true, chainId, refetchInterval } = options;

  const { address: connectedAddress } = useAccount();
  const owner = ownerOverride ?? connectedAddress;

  const isNativeToken = token.toLowerCase() === zeroAddress.toLowerCase();
  const queryEnabled = enabled && !isNativeToken && !!owner && amount > 0n;

  const allowance = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: owner ? [owner, spender] : undefined,
    chainId,
    query: {
      enabled: queryEnabled,
      refetchInterval,
    },
  });

  const isRequired: boolean | undefined = (() => {
    if (!queryEnabled) {
      return false;
    }
    if (allowance.isLoading || allowance.data === undefined) {
      return undefined;
    }

    return allowance.data < amount;
  })();

  const transaction = useTransaction({ chainId });

  const buildApproveCall = useCallback(
    (approveAmount?: bigint): WalletBatchCall => {
      if (isNativeToken) {
        throw new Error("Cannot approve native token");
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, approveAmount ?? maxUint256],
      });

      return {
        to: token,
        data,
        value: 0n,
      };
    },
    [isNativeToken, spender, token],
  );

  const approve = useCallback(
    async (approveAmount?: bigint) => {
      assertWalletConnected(owner);
      const call = buildApproveCall(approveAmount);
      if (!call.data) {
        throw new Error("Approval calldata not available");
      }

      const { hash } = await transaction.sendTransactionAndConfirm({
        to: call.to,
        data: call.data,
      });

      await allowance.refetch();

      return hash;
    },
    [owner, buildApproveCall, transaction, allowance],
  );

  return {
    allowance,
    isRequired,
    transaction,
    buildApproveCall,
    approve,
  };
}

export async function buildRequiredApprovalCall(approval: UseTokenApprovalReturn, token: Address, amount: bigint) {
  if (token.toLowerCase() === zeroAddress.toLowerCase() || amount <= 0n) {
    return undefined;
  }

  let isRequired = approval.isRequired;
  if (isRequired === undefined) {
    const { data } = await approval.allowance.refetch();
    if (data === undefined) {
      throw new Error(`Awaiting approval status for token ${token}`);
    }
    isRequired = data < amount;
  }

  return isRequired ? approval.buildApproveCall() : undefined;
}
