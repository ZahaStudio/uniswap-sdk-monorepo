"use client";

import { useCallback } from "react";

import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { usePosition, type UsePositionParams } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized } from "@/utils/assertions";

/**
 * Arguments for increasing liquidity on a position.
 */
export interface IncreaseLiquidityArgs {
  /** Amount of token0 to add (as string) */
  amount0?: string;
  /** Amount of token1 to add (as string) */
  amount1?: string;
  /** Recipient address for the position NFT */
  recipient: string;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Unix timestamp deadline (optional, default: 30 minutes from now) */
  deadline?: string;
}

/**
 * Current step in the increase liquidity lifecycle.
 */
export type IncreaseLiquidityStep = "approval0" | "approval1" | "permit2" | "execute" | "completed";

/**
 * Options for the usePositionIncreaseLiquidity hook.
 */
export interface UsePositionIncreaseLiquidityOptions {
  /** Override chain ID */
  chainId?: number;
  /** Amount of token0 for proactive approval checking */
  amount0?: bigint;
  /** Amount of token1 for proactive approval checking */
  amount1?: bigint;
  /** Callback fired when the transaction is confirmed */
  onSuccess?: () => void;
}

/**
 * Return type for the usePositionIncreaseLiquidity hook.
 */
export interface UsePositionIncreaseLiquidityReturn {
  /** All pipeline steps with individual state and actions */
  steps: {
    /** ERC-20 → Permit2 approval for token0 */
    approvalToken0: UseTokenApprovalReturn;
    /** ERC-20 → Permit2 approval for token1 */
    approvalToken1: UseTokenApprovalReturn;
    /** Off-chain Permit2 batch signature step */
    permit2: UsePermit2SignStep;
    /** Increase liquidity transaction execution step */
    execute: {
      transaction: UseTransactionReturn;
      execute: (args: IncreaseLiquidityArgs) => Promise<Hex>;
    };
  };
  /** The first incomplete required step */
  currentStep: IncreaseLiquidityStep;
  /** Execute all remaining required steps sequentially. Returns tx hash. */
  executeAll: (args: IncreaseLiquidityArgs) => Promise<Hex>;
  /** Reset all mutation state (approvals, permit2, transaction) */
  reset: () => void;
}

/**
 * Hook to increase liquidity on an existing Uniswap V4 position.
 *
 * Internally loads the position via `usePosition` and orchestrates ERC-20
 * approvals (to Permit2), off-chain Permit2 batch signing, and the increase
 * liquidity transaction. Automatically detects which steps are required
 * (e.g. native ETH skips approval and permit2) and refetches position data
 * when the transaction confirms.
 *
 * @param params - Operation parameters: tokenId
 * @param options - Configuration: amounts for approval checking, chainId, onSuccess
 * @returns Pipeline steps, current step indicator, executeAll action, and reset
 *
 * @example Step-by-step control
 * ```tsx
 * const increase = usePositionIncreaseLiquidity({ tokenId }, {
 *   amount0: parseUnits("100", 6),
 * });
 *
 * if (increase.steps.approvalToken0.isRequired) {
 *   await increase.steps.approvalToken0.approve();
 *   await increase.steps.approvalToken0.transaction.waitForConfirmation();
 * }
 * await increase.steps.permit2.sign();
 * await increase.steps.execute.execute({ amount0: "100", recipient: address });
 * ```
 *
 * @example One-click with executeAll
 * ```tsx
 * const increase = usePositionIncreaseLiquidity({ tokenId }, {
 *   amount0: parseUnits("100", 6),
 * });
 * const txHash = await increase.executeAll({ amount0: "100", recipient: address });
 * ```
 */
export function usePositionIncreaseLiquidity(
  params: UsePositionParams,
  options: UsePositionIncreaseLiquidityOptions = {},
): UsePositionIncreaseLiquidityReturn {
  const { tokenId } = params;
  const { chainId: overrideChainId, amount0 = 0n, amount1 = 0n, onSuccess } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });
  const { query } = usePosition({ tokenId }, { chainId: overrideChainId });

  const position = query.data;

  const token0Address = (
    position?.currency0?.isNative ? zeroAddress : (position?.currency0?.wrapped?.address ?? zeroAddress)
  ) as Address;
  const token1Address = (
    position?.currency1?.isNative ? zeroAddress : (position?.currency1?.wrapped?.address ?? zeroAddress)
  ) as Address;

  const positionManager = (sdk?.getContractAddress("positionManager") ?? zeroAddress) as Address;

  const permit2 = usePermit2(
    {
      tokens: [
        { address: token0Address, amount: amount0 },
        { address: token1Address, amount: amount1 },
      ],
      spender: positionManager,
    },
    {
      enabled: !!position,
      chainId,
    },
  );

  const transaction = useTransaction({
    onSuccess: () => {
      query.refetch();
      onSuccess?.();
    },
  });

  const executeWithPermit = useCallback(
    async (args: IncreaseLiquidityArgs, signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      if (!position) {
        throw new Error("Position not loaded. Wait for query to complete before increasing liquidity.");
      }
      assertSdkInitialized(sdk);
      const permit2Signed = signedPermit2 ?? permit2.permit2.signed;
      if (permit2.permit2.isRequired && !permit2Signed) {
        throw new Error("Permit2 signature required");
      }

      const batchPermit = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      const positionManagerAddress = sdk.getContractAddress("positionManager");
      const { calldata, value } = await sdk.buildAddLiquidityCallData({
        pool: position.pool,
        tickLower: position.position.tickLower,
        tickUpper: position.position.tickUpper,
        amount0: args.amount0,
        amount1: args.amount1,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadline: args.deadline,
        permit2BatchSignature: batchPermit,
      });

      return transaction.sendTransaction({
        to: positionManagerAddress,
        data: calldata as Hex,
        value: BigInt(value),
      });
    },
    [position, sdk, permit2.permit2.isRequired, permit2.permit2.signed, transaction],
  );

  const execute = useCallback(
    async (args: IncreaseLiquidityArgs): Promise<Hex> => executeWithPermit(args),
    [executeWithPermit],
  );

  const executeAll = useCallback(
    async (args: IncreaseLiquidityArgs): Promise<Hex> => {
      const signedPermit2 = await permit2.approveAndSign();
      return executeWithPermit(args, signedPermit2);
    },
    [permit2, executeWithPermit],
  );

  const currentStep: IncreaseLiquidityStep = (() => {
    if (permit2.currentStep !== "ready") {
      return permit2.currentStep;
    }
    if (transaction.status !== "confirmed") {
      return "execute";
    }
    return "completed";
  })();

  const reset = useCallback(() => {
    permit2.reset();
    transaction.reset();
  }, [permit2, transaction]);

  return {
    steps: {
      approvalToken0: permit2.approvals[0],
      approvalToken1: permit2.approvals[1],
      permit2: permit2.permit2,
      execute: {
        transaction,
        execute,
      },
    },
    currentStep,
    executeAll,
    reset,
  };
}
