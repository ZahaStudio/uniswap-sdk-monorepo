"use client";

import { useCallback, useMemo } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { PoolArgs, Pool } from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import { assertSdkInitialized } from "@/utils/assertions";
import { poolKeys } from "@/utils/queryKeys";

/**
 * Arguments for creating a new position (passed at execution time).
 */
export interface CreatePositionArgs {
  /** Amount of token0 to add (as string) */
  amount0?: string;
  /** Amount of token1 to add (as string) */
  amount1?: string;
  /** Recipient address for the position NFT */
  recipient: string;
  /** Lower tick boundary for the position */
  tickLower?: number;
  /** Upper tick boundary for the position */
  tickUpper?: number;
  /** Slippage tolerance in basis points (optional, default: 50 = 0.5%) */
  slippageTolerance?: number;
  /** Deadline duration in seconds from current block timestamp (optional) */
  deadlineDuration?: number;
}

/**
 * Current step in the create position lifecycle.
 */
export type CreatePositionStep = "approval0" | "approval1" | "permit2" | "execute" | "completed";

/**
 * Options for the useCreatePosition hook.
 */
export interface UseCreatePositionOptions {
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
 * Return type for the useCreatePosition hook.
 */
export interface UseCreatePositionReturn {
  /** Pool query result — use for UI display (current price, liquidity, fee tier) */
  pool: UseQueryResult<Pool>;
  /** All pipeline steps with individual state and actions */
  steps: {
    /** ERC-20 → Permit2 approval for token0 */
    approvalToken0: UseTokenApprovalReturn;
    /** ERC-20 → Permit2 approval for token1 */
    approvalToken1: UseTokenApprovalReturn;
    /** Off-chain Permit2 batch signature step */
    permit2: UsePermit2SignStep;
    /** Create position transaction execution step */
    execute: {
      transaction: UseTransactionReturn;
      execute: (args: CreatePositionArgs) => Promise<Hex>;
    };
  };
  /** The first incomplete required step */
  currentStep: CreatePositionStep;
  /** Execute all remaining required steps sequentially. Returns tx hash. */
  executeAll: (args: CreatePositionArgs) => Promise<Hex>;
  /** Reset all mutation state (approvals, permit2, transaction) */
  reset: () => void;
}

/**
 * Hook to create a new Uniswap V4 position (mint).
 *
 * Unlike `usePositionIncreaseLiquidity` which operates on an existing position,
 * this hook takes pool parameters directly and mints a brand new position.
 * It fetches the pool via `sdk.getPool()`, orchestrates ERC-20 approvals
 * (to Permit2), off-chain Permit2 batch signing, and the mint transaction.
 *
 * @param poolArgs - Pool identification: currencyA, currencyB, fee, tickSpacing, hooks
 * @param options - Configuration: amounts for approval checking, chainId, onSuccess
 * @returns Pool query, pipeline steps, current step indicator, executeAll action, and reset
 *
 * @example One-click with executeAll
 * ```tsx
 * const create = useCreatePosition(
 *   { currencyA: ETH, currencyB: USDC, fee: FeeTier.MEDIUM },
 *   { amount0: parseUnits("1", 18) },
 * );
 *
 * const txHash = await create.executeAll({
 *   amount0: "1000000000000000000",
 *   recipient: address,
 *   tickLower: -887220,
 *   tickUpper: 887220,
 * });
 * ```
 */
export function useCreatePosition(poolArgs: PoolArgs, options: UseCreatePositionOptions = {}): UseCreatePositionReturn {
  const { chainId: overrideChainId, amount0 = 0n, amount1 = 0n, onSuccess } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const poolQuery = useQuery({
    queryKey: poolKeys.detail(
      poolArgs.currencyA,
      poolArgs.currencyB,
      poolArgs.fee,
      poolArgs.tickSpacing,
      poolArgs.hooks,
      chainId,
    ),
    queryFn: async (): Promise<Pool> => {
      assertSdkInitialized(sdk);
      return sdk.getPool(poolArgs);
    },
    enabled: !!poolArgs.currencyA && !!poolArgs.currencyB && !!sdk,
  });

  const pool = poolQuery.data;

  const tokenAddresses = useMemo(() => {
    if (!pool) {
      return [zeroAddress, zeroAddress] as [Address, Address];
    }

    const token0 = pool.currency0.isNative ? zeroAddress : (pool.currency0.wrapped.address as Address);
    const token1 = pool.currency1.isNative ? zeroAddress : (pool.currency1.wrapped.address as Address);

    return [token0, token1] as [Address, Address];
  }, [pool]);

  const positionManager = sdk.getContractAddress("positionManager");

  const permit2Hook = usePermit2(
    {
      tokens: [
        {
          address: tokenAddresses[0],
          amount: amount0,
        },
        {
          address: tokenAddresses[1],
          amount: amount1,
        },
      ],
      spender: positionManager,
    },
    {
      enabled: !!pool,
      chainId,
    },
  );

  const transaction = useTransaction({
    onSuccess: () => {
      onSuccess?.();
    },
  });

  const executeWithPermit = useCallback(
    async (args: CreatePositionArgs, signedPermit2?: Permit2SignedResult): Promise<Hex> => {
      if (!pool) {
        throw new Error("Pool not loaded. Wait for pool query to complete before creating a position.");
      }
      assertSdkInitialized(sdk);
      const permit2Signed = signedPermit2 ?? permit2Hook.permit2.signed;
      if (permit2Hook.permit2.isRequired && !permit2Signed) {
        throw new Error("Permit2 signature required");
      }

      const batchPermit = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      console.log({ batchPermit, permit2Signed });

      const positionManagerAddress = sdk.getContractAddress("positionManager");
      const { calldata, value } = await sdk.buildAddLiquidityCallData({
        pool,
        tickLower: args.tickLower,
        tickUpper: args.tickUpper,
        amount0: args.amount0,
        amount1: args.amount1,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadlineDuration: args.deadlineDuration,
        permit2BatchSignature: batchPermit,
      });

      return transaction.sendTransaction({
        to: positionManagerAddress,
        data: calldata as Hex,
        value: BigInt(value),
      });
    },
    [pool, sdk, permit2Hook.permit2.isRequired, permit2Hook.permit2.signed, transaction],
  );

  const execute = useCallback(
    async (args: CreatePositionArgs): Promise<Hex> => executeWithPermit(args),
    [executeWithPermit],
  );

  const executeAll = useCallback(
    async (args: CreatePositionArgs): Promise<Hex> => {
      const signedPermit2 = await permit2Hook.approveAndSign();
      return executeWithPermit(args, signedPermit2);
    },
    [permit2Hook, executeWithPermit],
  );

  const currentStep: CreatePositionStep = (() => {
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
    pool: poolQuery,
    steps: {
      approvalToken0: permit2Hook.approvals[0],
      approvalToken1: permit2Hook.approvals[1],
      permit2: permit2Hook.permit2,
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
