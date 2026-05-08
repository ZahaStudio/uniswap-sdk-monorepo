"use client";

import { useCallback, useMemo } from "react";

import type { Currency } from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";

import { zeroAddress } from "viem";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { buildRequiredApprovalCall, type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import {
  useTransaction,
  type SendBatchTransactionAndConfirmResult,
  type UseTransactionReturn,
} from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized } from "@/utils/assertions";

/**
 * Current step in an add-liquidity pipeline.
 */
export type AddLiquidityStep = "loading" | "approval0" | "approval1" | "permit2" | "execute" | "completed";

/**
 * Context passed to the `buildCalldata` callback.
 */
export interface BuildCalldataContext<TArgs> {
  batchPermit:
    | ReturnType<Permit2SignedResult & { kind: "batch" } extends { data: infer D } ? () => D : never>
    | undefined;
  args: TArgs;
}

/**
 * Parameters for the useAddLiquidityPipeline hook.
 */
export interface AddLiquidityPipelineParams<TArgs> {
  /** The two currencies in the pool — undefined while loading */
  currencies: [Currency, Currency] | undefined;
  /** Permit2 amounts for [token0, token1] */
  permit2Amounts: [bigint, bigint];
  /** Whether the pipeline is enabled (e.g. pool/position loaded) */
  enabled: boolean;
  /** Optional chain ID override */
  chainId?: number;
  /** Callback invoked after the transaction succeeds */
  onSuccess?: () => void;
  /** Builds the calldata for the add-liquidity transaction */
  buildCalldata: (ctx: {
    batchPermit: BuildCalldataContext<TArgs>["batchPermit"];
    args: TArgs;
  }) => Promise<{ calldata: string; value: string }>;
}

/**
 * Return type for the useAddLiquidityPipeline hook.
 */
export interface AddLiquidityPipelineReturn<TArgs> {
  /** All pipeline steps with individual state and actions */
  steps: {
    /** ERC-20 → Permit2 approval for token0 */
    approvalToken0: UseTokenApprovalReturn;
    /** ERC-20 → Permit2 approval for token1 */
    approvalToken1: UseTokenApprovalReturn;
    /** Off-chain Permit2 batch signature step */
    permit2: UsePermit2SignStep;
    /** Transaction execution step */
    execute: {
      transaction: UseTransactionReturn;
      execute: (args: TArgs) => Promise<Hex>;
      executeBatch: (args: TArgs) => Promise<SendBatchTransactionAndConfirmResult>;
    };
  };
  /** The first incomplete required step */
  currentStep: AddLiquidityStep;
  /** Execute all remaining required steps sequentially. Returns tx hash. */
  executeAll: (args: TArgs) => Promise<Hex>;
  /** Execute all required onchain calls as one atomic EIP-5792 batch. */
  executeBatch: (args: TArgs) => Promise<SendBatchTransactionAndConfirmResult>;
  /** Reset all mutation state (approvals, permit2, transaction) */
  reset: () => void;
}

/**
 * Shared pipeline hook for add-liquidity flows (create position & increase liquidity).
 *
 * Owns token address extraction, Permit2 setup, transaction orchestration,
 * step tracking, and reset. The consumer provides a `buildCalldata` callback
 * that constructs the specific calldata for their operation.
 */
export function useAddLiquidityPipeline<TArgs>(
  params: AddLiquidityPipelineParams<TArgs>,
): AddLiquidityPipelineReturn<TArgs> {
  const { currencies, permit2Amounts, enabled, chainId: overrideChainId, onSuccess, buildCalldata } = params;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const tokenAddresses = useMemo(() => {
    if (!currencies) {
      return [zeroAddress, zeroAddress] as [Address, Address];
    }

    const token0 = currencies[0].isNative ? zeroAddress : (currencies[0].wrapped.address as Address);
    const token1 = currencies[1].isNative ? zeroAddress : (currencies[1].wrapped.address as Address);

    return [token0, token1] as [Address, Address];
  }, [currencies]);

  const positionManager = sdk.getContractAddress("positionManager");

  const permit2Hook = usePermit2(
    {
      tokens: [
        { address: tokenAddresses[0], amount: permit2Amounts[0] },
        { address: tokenAddresses[1], amount: permit2Amounts[1] },
      ],
      spender: positionManager,
    },
    {
      enabled: enabled && !!currencies,
      chainId,
    },
  );

  const transaction = useTransaction({ chainId });

  const executeWithPermit = useCallback(
    async (args: TArgs, signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      assertSdkInitialized(sdk);

      const permit2Signed = signedPermit2 ?? permit2Hook.permit2.signed;
      if (permit2Hook.permit2.isRequired && !permit2Signed) {
        throw new Error("Permit2 signature required");
      }

      const batchPermit = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      const { calldata, value } = await buildCalldata({ batchPermit, args });

      const { hash } = await transaction.sendTransactionAndConfirm({
        to: positionManager,
        data: calldata as Hex,
        value: BigInt(value),
      });

      void onSuccess?.();

      return hash;
    },
    [sdk, permit2Hook.permit2, buildCalldata, transaction, positionManager, onSuccess],
  );

  const execute = useCallback(async (args: TArgs): Promise<Hex> => executeWithPermit(args), [executeWithPermit]);

  const executeBatchWithPermit = useCallback(
    async (args: TArgs, signedPermit2?: Permit2SignedResult): Promise<SendBatchTransactionAndConfirmResult> => {
      assertSdkInitialized(sdk);
      if (!transaction.isAtomicBatchSupported) {
        throw new Error("Atomic batch support is not available.");
      }

      const permit2Signed = signedPermit2 ?? permit2Hook.permit2.signed ?? (await permit2Hook.permit2.sign());
      if (permit2Hook.permit2.isRequired && !permit2Signed) {
        throw new Error("Permit2 signature required");
      }

      const batchPermit = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;
      const { calldata, value } = await buildCalldata({ batchPermit, args });

      const approval0Call = await buildRequiredApprovalCall(
        permit2Hook.approvals[0],
        tokenAddresses[0],
        permit2Amounts[0],
      );
      const approval1Call = await buildRequiredApprovalCall(
        permit2Hook.approvals[1],
        tokenAddresses[1],
        permit2Amounts[1],
      );

      const result = await transaction.sendBatchTransactionAndConfirm({
        calls: [
          ...[approval0Call, approval1Call].filter((call): call is NonNullable<typeof call> => call !== undefined),
          {
            to: positionManager,
            data: calldata as Hex,
            value: BigInt(value),
          },
        ],
      });

      if (result.status.status === "success") {
        void Promise.all([
          approval0Call ? permit2Hook.approvals[0].allowance.refetch() : undefined,
          approval1Call ? permit2Hook.approvals[1].allowance.refetch() : undefined,
        ]);
        void onSuccess?.();
      }

      return result;
    },
    [
      sdk,
      permit2Hook.permit2,
      permit2Hook.approvals,
      buildCalldata,
      tokenAddresses,
      permit2Amounts,
      transaction,
      positionManager,
      onSuccess,
    ],
  );

  const executeBatch = useCallback(
    async (args: TArgs): Promise<SendBatchTransactionAndConfirmResult> => executeBatchWithPermit(args),
    [executeBatchWithPermit],
  );

  const executeAll = useCallback(
    async (args: TArgs): Promise<Hex> => {
      const signedPermit2 = await permit2Hook.approveAndSign();
      return executeWithPermit(args, signedPermit2);
    },
    [permit2Hook, executeWithPermit],
  );

  const currentStep: AddLiquidityStep = (() => {
    if (!enabled || !currencies) {
      return "loading";
    }
    if (permit2Hook.currentStep !== "ready") {
      return permit2Hook.currentStep;
    }
    if (transaction.status !== "confirmed") {
      return "execute";
    }
    return "completed";
  })();

  const reset = useCallback(() => {
    permit2Hook.reset();
    transaction.reset();
  }, [permit2Hook, transaction]);

  return {
    steps: {
      approvalToken0: permit2Hook.approvals[0],
      approvalToken1: permit2Hook.approvals[1],
      permit2: permit2Hook.permit2,
      execute: {
        transaction,
        execute,
        executeBatch,
      },
    },
    currentStep,
    executeAll,
    executeBatch,
    reset,
  };
}
