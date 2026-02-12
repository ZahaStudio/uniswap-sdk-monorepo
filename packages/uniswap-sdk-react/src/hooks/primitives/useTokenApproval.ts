"use client";

import { useCallback } from "react";

import type { Address } from "viem";
import { erc20Abi, encodeFunctionData, maxUint256, zeroAddress } from "viem";
import { useAccount, useReadContract } from "wagmi";

import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import type { UseHookOptions } from "@/types/hooks";

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
  /**
   * Send an approval transaction.
   * @param amount - Amount to approve (defaults to maxUint256 for unlimited approval)
   * @returns The transaction hash
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
 * if (approval.isRequired) {
 *   await approval.approve(); // Sends token.approve(PERMIT2, maxUint256)
 *   await approval.transaction.waitForConfirmation();
 * }
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

  const transaction = useTransaction({
    onSuccess: () => {
      // Refetch allowance after approval confirms
      allowance.refetch();
    },
  });

  const approve = useCallback(
    async (approveAmount?: bigint) => {
      if (isNativeToken) {
        throw new Error("Cannot approve native token");
      }
      if (!owner) {
        throw new Error("No wallet connected");
      }

      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, approveAmount ?? maxUint256],
      });

      return transaction.sendTransaction({
        to: token,
        data,
      });
    },
    [isNativeToken, owner, token, spender, transaction],
  );

  return {
    allowance,
    isRequired,
    transaction,
    approve,
  };
}
