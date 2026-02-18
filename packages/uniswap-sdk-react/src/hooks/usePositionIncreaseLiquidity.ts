"use client";

import { useCallback } from "react";

import type { Address, Hex } from "viem";

import { useAddLiquidityPipeline, type AddLiquidityStep } from "@/hooks/primitives/useAddLiquidityPipeline";
import { type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { usePosition, type UsePositionParams } from "@/hooks/usePosition";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseMutationHookOptions } from "@/types/hooks";
import { assertSdkInitialized } from "@/utils/assertions";

/**
 * Arguments for increasing liquidity on a position.
 */
export interface IncreaseLiquidityArgs {
  /** Amount of token0 to add */
  amount0?: bigint;
  /** Amount of token1 to add */
  amount1?: bigint;
  /** Recipient address for the position NFT */
  recipient: Address;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Deadline duration in seconds from current block timestamp (optional) */
  deadlineDuration?: number;
}

/**
 * Options for the usePositionIncreaseLiquidity hook.
 */
export interface UsePositionIncreaseLiquidityOptions extends UseMutationHookOptions {
  /** Amount of token0 for proactive approval checking */
  amount0?: bigint;
  /** Amount of token1 for proactive approval checking */
  amount1?: bigint;
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
  currentStep: AddLiquidityStep;
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
  const { chainId: overrideChainId, amount0 = 0n, amount1 = 0n, onSuccess } = options;

  const { sdk } = useUniswapSDK({ chainId: overrideChainId });
  const { query } = usePosition(params, { chainId: overrideChainId });

  const position = query.data;

  const onPipelineSuccess = useCallback(() => {
    query.refetch();
    onSuccess?.();
  }, [query, onSuccess]);

  const buildCalldata = useCallback(
    async ({ batchPermit, args }: { batchPermit: unknown; args: IncreaseLiquidityArgs }) => {
      if (!position) {
        throw new Error("Position not loaded. Wait for query to complete before increasing liquidity.");
      }
      assertSdkInitialized(sdk);

      return sdk.buildAddLiquidityCallData({
        pool: position.pool,
        tickLower: position.position.tickLower,
        tickUpper: position.position.tickUpper,
        amount0: args.amount0?.toString(),
        amount1: args.amount1?.toString(),
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadlineDuration: args.deadlineDuration,
        permit2BatchSignature: batchPermit as Parameters<
          typeof sdk.buildAddLiquidityCallData
        >[0]["permit2BatchSignature"],
      });
    },
    [position, sdk],
  );

  const pipeline = useAddLiquidityPipeline<IncreaseLiquidityArgs>({
    currencies: position ? [position.currency0, position.currency1] : undefined,
    permit2Amounts: [amount0, amount1],
    enabled: !!position,
    chainId: overrideChainId,
    onSuccess: onPipelineSuccess,
    buildCalldata,
  });

  return {
    steps: pipeline.steps,
    currentStep: pipeline.currentStep,
    executeAll: pipeline.executeAll,
    reset: pipeline.reset,
  };
}
