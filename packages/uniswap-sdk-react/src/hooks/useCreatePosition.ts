"use client";

import { useCallback, useMemo } from "react";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { Position, nearestUsableTick, TickMath } from "@zahastudio/uniswap-sdk";
import type { PoolKey, Pool } from "@zahastudio/uniswap-sdk";
import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";

import { usePermit2, type Permit2SignedResult, type UsePermit2SignStep } from "@/hooks/primitives/usePermit2";
import { type UseTokenApprovalReturn } from "@/hooks/primitives/useTokenApproval";
import { useTransaction, type UseTransactionReturn } from "@/hooks/primitives/useTransaction";
import { useUniswapSDK } from "@/hooks/useUniswapSDK";
import type { UseMutationHookOptions } from "@/types/hooks";
import { assertSdkInitialized } from "@/utils/assertions";
import { poolKeys } from "@/utils/queryKeys";

/**
 * Arguments for creating a new position (passed at execution time).
 */
export interface CreatePositionArgs {
  /** Recipient address for the position NFT */
  recipient: Address;
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
 * Calculated position amounts derived from the user-provided input.
 */
export interface CalculatedPosition {
  /** Raw bigint amount of token0 */
  amount0: bigint;
  /** Raw bigint amount of token1 */
  amount1: bigint;
  /** Human-readable amount of token0 */
  formattedAmount0: string;
  /** Human-readable amount of token1 */
  formattedAmount1: string;
}

/**
 * Resolved tick range for the position.
 */
export interface ResolvedTickRange {
  tickLower: number;
  tickUpper: number;
}

/**
 * Parameters for the useCreatePosition hook.
 */
export interface UseCreatePositionParams {
  /** V4 pool key identifying the pool */
  poolKey: PoolKey;
  /** Amount of token0 to add — pass only the user-edited amount, leave the other undefined */
  amount0?: bigint;
  /** Amount of token1 to add — pass only the user-edited amount, leave the other undefined */
  amount1?: bigint;
  /** Lower tick boundary (optional, defaults to full-range) */
  tickLower?: number;
  /** Upper tick boundary (optional, defaults to full-range) */
  tickUpper?: number;
}

/**
 * Options for the useCreatePosition hook.
 */
export interface UseCreatePositionOptions extends UseMutationHookOptions {}

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
  /** Calculated position amounts from the user-provided input, null while loading or no input */
  position: CalculatedPosition | null;
  /** Resolved tick range, null while pool is loading */
  tickRange: ResolvedTickRange | null;
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
 * Fetches the pool via `sdk.getPool()`, computes the Position from the
 * user-provided amount (using `Position.fromAmount0` or `fromAmount1`),
 * orchestrates ERC-20 approvals (to Permit2), off-chain Permit2 batch
 * signing, and the mint transaction.
 *
 * The caller passes only the user-edited amount (`amount0` or `amount1`),
 * and the hook computes the complementary amount automatically.
 *
 * @param params - Pool key, amounts, and tick range
 * @param options - Configuration: chainId, onSuccess
 * @returns Pool query, calculated position, pipeline steps, current step indicator, executeAll action, and reset
 *
 * @example One-click with executeAll
 * ```tsx
 * const create = useCreatePosition(
 *   {
 *     poolKey: { currency0: ETH, currency1: USDC, fee: 3000, tickSpacing: 60, hooks: ZERO_ADDRESS },
 *     amount0: parseUnits("1", 18),
 *     tickLower: -887220,
 *     tickUpper: 887220,
 *   },
 * );
 *
 * // Computed amounts available via create.position
 * // create.position.formattedAmount1 → auto-calculated token1 amount
 *
 * const txHash = await create.executeAll({ recipient: address });
 * ```
 */
export function useCreatePosition(
  params: UseCreatePositionParams,
  options: UseCreatePositionOptions = {},
): UseCreatePositionReturn {
  const { poolKey, amount0, amount1, tickLower: paramTickLower, tickUpper: paramTickUpper } = params;
  const { chainId: overrideChainId, onSuccess } = options;

  const { sdk, chainId } = useUniswapSDK({ chainId: overrideChainId });

  const poolQuery = useQuery({
    queryKey: poolKeys.detail(
      poolKey.currency0,
      poolKey.currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks,
      chainId,
    ),
    queryFn: async (): Promise<Pool> => {
      assertSdkInitialized(sdk);
      return sdk.getPool(poolKey);
    },
    enabled: !!poolKey?.currency0 && !!poolKey?.currency1 && !!sdk,
  });

  const pool = poolQuery.data;

  const tickRange = useMemo((): ResolvedTickRange | null => {
    if (!pool) {
      return null;
    }

    const tickLower = paramTickLower ?? nearestUsableTick(TickMath.MIN_TICK, pool.tickSpacing);
    const tickUpper = paramTickUpper ?? nearestUsableTick(TickMath.MAX_TICK, pool.tickSpacing);

    return {
      tickLower,
      tickUpper,
    };
  }, [pool, paramTickLower, paramTickUpper]);

  const calculatedPosition = useMemo((): CalculatedPosition | null => {
    if (!pool || !tickRange) {
      return null;
    }

    const hasAmount0 = amount0 !== undefined && amount0 > 0n;
    const hasAmount1 = amount1 !== undefined && amount1 > 0n;

    // Need exactly one amount to compute the other
    if (!hasAmount0 && !hasAmount1) {
      return null;
    }

    try {
      let pos: Position;

      if (hasAmount0 && !hasAmount1) {
        pos = Position.fromAmount0({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount0: amount0!.toString(),
          useFullPrecision: true,
        });
      } else if (hasAmount1 && !hasAmount0) {
        pos = Position.fromAmount1({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount1: amount1!.toString(),
        });
      } else {
        pos = Position.fromAmounts({
          pool,
          tickLower: tickRange.tickLower,
          tickUpper: tickRange.tickUpper,
          amount0: amount0!.toString(),
          amount1: amount1!.toString(),
          useFullPrecision: true,
        });
      }

      return {
        amount0: BigInt(pos.amount0.quotient.toString()),
        amount1: BigInt(pos.amount1.quotient.toString()),
        formattedAmount0: pos.amount0.toExact(),
        formattedAmount1: pos.amount1.toExact(),
      };
    } catch {
      return null;
    }
  }, [pool, tickRange, amount0, amount1]);

  const tokenAddresses = useMemo(() => {
    if (!pool) {
      return [zeroAddress, zeroAddress] as [Address, Address];
    }

    const token0 = pool.currency0.isNative ? zeroAddress : pool.currency0.wrapped.address;
    const token1 = pool.currency1.isNative ? zeroAddress : pool.currency1.wrapped.address;

    return [token0, token1] as [Address, Address];
  }, [pool]);

  const positionManager = sdk.getContractAddress("positionManager");

  // Use calculated amounts for permit2 approvals
  const permit2Amount0 = calculatedPosition?.amount0 ?? 0n;
  const permit2Amount1 = calculatedPosition?.amount1 ?? 0n;

  const permit2Hook = usePermit2(
    {
      tokens: [
        {
          address: tokenAddresses[0],
          amount: permit2Amount0,
        },
        {
          address: tokenAddresses[1],
          amount: permit2Amount1,
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
      if (!tickRange) {
        throw new Error("Tick range not resolved. Wait for pool query to complete.");
      }
      assertSdkInitialized(sdk);
      const permit2Signed = signedPermit2 ?? permit2Hook.permit2.signed;
      if (permit2Hook.permit2.isRequired && !permit2Signed) {
        throw new Error("Permit2 signature required");
      }

      const batchPermit = permit2Signed?.kind === "batch" ? permit2Signed.data : undefined;

      // Pass only the user-provided amount so buildAddLiquidityCallData uses
      // fromAmount0/fromAmount1 (matching the hook's calculation)
      const { calldata, value } = await sdk.buildAddLiquidityCallData({
        pool,
        tickLower: tickRange.tickLower,
        tickUpper: tickRange.tickUpper,
        amount0: amount0 !== undefined && amount0 > 0n ? amount0.toString() : undefined,
        amount1: amount1 !== undefined && amount1 > 0n ? amount1.toString() : undefined,
        recipient: args.recipient,
        slippageTolerance: args.slippageTolerance,
        deadlineDuration: args.deadlineDuration,
        permit2BatchSignature: batchPermit,
      });

      return transaction.sendTransaction({
        to: positionManager,
        data: calldata as Hex,
        value: BigInt(value),
      });
    },
    [pool, tickRange, sdk, permit2Hook.permit2, amount0, amount1, transaction, positionManager],
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
    position: calculatedPosition,
    tickRange,
    currentStep,
    executeAll,
    reset,
  };
}
